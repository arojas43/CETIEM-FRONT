# Arquitectura del Sistema

---

## Visión general

```
Usuario
  │
  ▼
Next.js 15 (App Router)
  ├── API Routes (/api/*)
  └── UI Dashboard
        │
        ├── PostgreSQL (Prisma)   ← documentos, índices PageIndex, usuarios
        ├── FalkorDB :6380        ← grafo de entidades y relaciones
        └── Redis :6379           ← colas BullMQ para workers
```

Los **workers** corren como proceso separado (`npm run workers`) y consumen las colas Redis. Next.js y los workers comparten acceso a PostgreSQL y FalkorDB pero no comparten memoria.

---

## Flujo 1 — Subida de documento

```
POST /api/documents (multipart/form-data)
  │
  ├── Validar auth (NextAuth)
  ├── Validar tipo PDF
  ├── prisma.document.create (status: PENDING)
  ├── localStorageService.saveFileWithId → ./uploads/{id}/{id}.pdf
  └── documentProcessingQueue.add("index") → Redis/BullMQ
        │
        └── [si Redis no disponible] → queda en PENDING para procesar manualmente
```

---

## Flujo 2 — Procesamiento de documento

Hay dos caminos que llegan al mismo pipeline:

**A) Automático vía worker BullMQ** (al subir):
```
Worker → processDocumentIndexing() → [encola análisis]
       → Worker AI → processDocumentAnalysis()
```

**B) Manual vía botón "Procesar"** en la UI:
```
POST /api/documents/[id]/process
  → processDocument() en process-document-service.ts
  → Ejecuta PageIndex + Cognee en secuencia directa
```

### Pipeline PageIndex (extracción de estructura)

```
pageIndexService.buildIndex(id, pdfBuffer, name)
  │
  ├── extractFullText(pdfBuffer)                 ← pdfjs-dist, extracción real por página
  │     └── [si vacío] → Tesseract OCR           ← para PDFs escaneados
  │
  ├── detectStructure(text)
  │     ├── LLM (Llama 3.1 70B) → JSON {title, sections[]}
  │     └── Fallback: estructura plana si LLM falla
  │
  └── buildIndex()
        ├── Nodo raíz (título del documento)
        ├── Nodos de sección (level 1) — del LLM
        └── Nodos de página (level 2, isPageNode:true) — siempre creados

→ flattenNodes() → prisma.pageIndex.create × N nodos
→ document.status = INDEXED
```

Para documentos >50MB usa `pdftotext` (poppler) con streaming en lugar de pdfjs.

### Pipeline Cognee (extracción de conocimiento)

```
Por cada nodo PageIndex con content > 50 chars:
  │
  ├── chunk = "${title}: ${content.slice(0, 2000)}"
  │
  ├── cogneeService.extractKnowledge(chunk, documentId, domain)
  │     ├── buildDomainPrompt() — prompt específico por dominio con exampleOutput
  │     ├── nimService.generateText (Llama 3.1, temp=0.2, max_tokens=4000)
  │     └── parseKnowledgeGraph(response)
  │           ├── extractFirstJSON() — extractor con llaves balanceadas
  │           └── Mapear entities[] + relations[]
  │
  └── cogneeService.persistToGraph(entities, relations, documentId)
        ├── createEntitiesBatch() → UNWIND [...] CREATE (n:LABEL {props})
        └── createRelation() → MATCH (a {id}), (b {id}) CREATE (a)-[r:TYPE]->(b)

→ document.status = ANALYZED (si hay entidades) | INDEXED
```

**Dominios soportados:** `medical`, `legal`, `technical`, `academic`, `custom`

Cada entidad guarda `documentId`, `page`, `section` para trazabilidad.

---

## Flujo 3 — Q&A

```
POST /api/documents/[id]/search { query }
  │  maxDuration: 120s
  │
  └── qaService.answerSpecificQuestion(query, documentId, documentName)
```

### Paso 1 — Extracción de intención

```
extractQueryIntent(query)
  ├── page:      /p[áa]ginas?\s+(\d+)/
  ├── section:   /secc?...\s+(\d[A-Z0-9.-]*|[IVX]{1,6}...)/ (solo IDs numéricos/romanos)
  └── paragraph: /p[áa]rrafo?\s+(\d+)/ + mapa de ordinales en español
```

### Paso 2 — Búsqueda en PageIndex

```
Si isSpecific (page/section/paragraph):
  → prisma.pageIndex.findMany con filtros exactos
  → Si paragraph: extractParagraphs() + índice

Si sin resultados → LLM Tree Search:
  → Serializar árbol de nodos (sin content, excluye isPageNode)
  → nimService.generateText (Llama 3.1, temp=0.0, max_tokens=256)
    prompt: "[\"  ← inducción de completion
  → Parsear JSON array de IDs → prisma.pageIndex.findMany(ids)

Si sin resultados → keyword fallback:
  → detectBiblicalReference() — allowlist de libros bíblicos
  → OR search sobre title/content en PageIndex
```

### Paso 3 — Enriquecer con FalkorDB

```
MATCH (n) WHERE n.documentId = "..." AND n.page IN [páginas_del_contexto]
RETURN labels(n)[0], n.name, n.description, n.page
LIMIT 50
```

### Paso 4 — Generar respuesta

```
qwenQAService.generateAnswer(question, pageIndexContext, entities)
  → POST https://integrate.api.nvidia.com/v1/chat/completions
     model: qwen/qwen3.5-122b-a10b
     max_tokens: 4096, temperature: 0.4, stream: true
  → consumeStream() → SSE reader → filtra <think>...</think>
  → [si falla] fallback → nimService (Llama 3.1 70B)
```

---

## Dual LLM

| Modelo | Rol | Cuándo se usa |
|--------|-----|--------------|
| Llama 3.1 70B (`NVIDIA_API_KEY`) | Procesamiento | Extracción de estructura, extracción de entidades, LLM Tree Search |
| Qwen 3.5 122B (`NVIDIA_QA_API_KEY`) | Respuestas | Generación de respuestas Q&A (streaming) |

Usar dos API keys separadas permite distribuir la carga y facturación por función.

---

## Aislamiento de grafos

Todos los nodos en FalkorDB llevan la propiedad `documentId`. Las consultas siempre filtran por ella:

```cypher
MATCH (n) WHERE n.documentId = "doc-id-especifico" RETURN n
```

Esto permite que múltiples documentos coexistan en el mismo grafo `certificacion` sin interferencia.

Los índices en FalkorDB sobre `documentId` se crean automáticamente al conectar:

```cypher
CREATE INDEX FOR (n:ORGANIZATION) ON (n.documentId)
-- repite para los 20 tipos de entidad definidos
```

---

## Progreso de procesamiento

`process-document-service.ts` actualiza `document.processingProgress` en PostgreSQL cada 5 chunks:

```json
{
  "step": "Analizando chunk 45/200",
  "percentage": 67,
  "details": { "stage": "cognee", "entitiesExtracted": 312 },
  "updatedAt": "2026-03-23T..."
}
```

La UI hace polling a `GET /api/documents/[id]/progress` y muestra barras de progreso en tiempo real.

---

## Decisiones de diseño relevantes

- **pdfjs-dist** en lugar de pdf-parse: extracción real por página con coordenadas Y para detectar párrafos
- **UNWIND batch** en FalkorDB: agrupa entidades por label y hace una sola query por tipo (órdenes de magnitud más rápido que un CREATE por entidad)
- **`extractFirstJSON()`**: extractor con conteo de llaves balanceadas en lugar de regex greedy — robusto cuando el LLM añade texto después del JSON
- **`stop-writes-on-bgsave-error no`** en FalkorDB: evita que un fallo de snapshot RDB bloquee todas las escrituras
- **`maxDuration = 120`** en la route de search: evita que Next.js corte la conexión antes de que Qwen termine
