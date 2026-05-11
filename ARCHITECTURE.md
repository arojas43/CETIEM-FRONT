# CETIEM — Arquitectura de la Plataforma ESG

> Documentación técnica actualizada. Refleja el estado actual del stack tras la migración a **PageIndex + OpenKB** (eliminando FalkorDB y Cognee.ai).

---

## 1. Visión General

La plataforma CETIEM permite a empresas obtener su certificación ESG con el Programa CETIEM de la Secretaría de Economía. La IA analiza los documentos subidos, genera un dictamen preliminar y lo pone a disposición del assessor ESG para revisión.

```
Empresa sube docs
       ↓
Pipeline: PageIndex → OpenKB
       ↓
Kimi K2.6 genera dictamen (VLAP + hallazgos)
       ↓
Admin ve dictamen → asigna assessor
       ↓
Assessor revisa docs con ayuda de IA → emite/deniega certificado ESG
```

---

## 2. Stack tecnológico

| Capa | Tecnología | Rol |
|------|-----------|-----|
| **Frontend** | Next.js 15 (App Router) | UI multi-rol: empresa / assessor / admin |
| **Auth** | NextAuth.js | Sesiones, roles (COMPANY / ASSESSOR / ADMIN) |
| **Base de datos** | PostgreSQL 16 (local) | Usuarios, documentos, PageIndex, dictámenes, certificados |
| **Cola de trabajo** | BullMQ + Redis 7 | Procesamiento asíncrono de documentos |
| **Indexación de docs** | PageIndex (local, pdfjs) | Árbol jerárquico PDF → Postgres |
| **KB de conocimiento** | OpenKB (FastAPI wrapper) | Wiki por empresa → Q&A cross-documento |
| **LLM principal** | Kimi K2.6 vía NVIDIA NIM | Dictamen IA + búsqueda semántica |
| **LLM auxiliar** | Llama 3.1 70B vía NVIDIA NIM | Q&A fallback, tree search |
| **Almacenamiento** | Local (`./uploads/`) | PDFs de empresas — GCS planificado para Cloud Run |

### Lo que SE ELIMINÓ y por qué

| Eliminado | Reemplazado por | Razón |
|-----------|----------------|-------|
| **FalkorDB** | OpenKB | Grafo de entidades → wiki cross-documento sin DB de grafos |
| **Cognee.ai** | OpenKB | Extracción de entidades LLM → compilación wiki OpenKB |
| `falkordb.ts` | — | 800 LOC de cliente FalkorDB, ya no necesario |
| `cognee-service.ts` | `pipeline-types.ts` | 700 LOC de extracción batch, solo se conservan los tipos |
| `large-document-batch.ts` | — | Batch processing para FalkorDB, obsoleto |
| `cognee-api/` (Python) | `openkb-api/` (Python) | Cognee.ai server → OpenKB FastAPI wrapper |
| Rutas `/api/graph/*` | — | Consultas Cypher → OpenKB Q&A |
| Dashboard grafo | — | Visualización FalkorDB, sin reemplazo en UI |

---

## 3. Servicios Docker

```yaml
# docker-compose.yml — servicios activos
postgres:16-alpine    → Puerto 5434  (datos relacionales + PageIndex)
redis:7-alpine        → Puerto 6381  (BullMQ colas)
openkb-api            → Puerto 8001  (KB wiki por empresa, Q&A)
app (Next.js)         → Puerto 3000  (interfaz web)
workers (BullMQ)      → interno      (procesamiento en background)
db-init               → one-shot     (prisma db push + seed)
```

### Arranque rápido

```bash
cp .env.example .env          # Editar NVIDIA_API_KEY
docker compose up --build
# App: http://localhost:3000
# OpenKB: http://localhost:8001/health
```

---

## 4. Servicio OpenKB (`openkb-api/`)

### Qué es OpenKB
OpenKB (VectifyAI) construye un knowledge base wiki-style a partir de documentos. En lugar de un grafo de entidades (FalkorDB), crea archivos Markdown interconectados:

```
/data/kb/<companyId>/
  wiki/
    index.md              ← índice central
    summaries/            ← resumen por documento
    concepts/             ← páginas cross-documento (ej: "ISO 14001.md")
    sources/              ← contenido completo indexado
```

### Por qué un KB por empresa (no por documento)
El `companyId` es el `datasetName` del KB. Esto permite que OpenKB haga razonamiento **cross-documento**: si la empresa tiene 4 docs, OpenKB los sintetiza en páginas de conceptos (`concepts/`) que relacionan información entre ellos — igual que FalkorDB relacionaba entidades.

### Endpoints del microservicio

```
POST /api/v1/add
  Form: data (file), datasetName (companyId)
  → Indexa el documento en el KB de la empresa
  → Hash SHA-256 evita reindexar si el contenido no cambió

POST /api/v1/search
  Body: { query, datasets: [companyId], top_k: 10 }
  → run_query() de OpenKB sobre el wiki de la empresa
  → Responde con razonamiento sobre todos los documentos

GET /health
  → {"status": "ok", "model": "openai/moonshotai/kimi-k2.6"}
```

### Cliente TypeScript: `src/lib/openkb-client.ts`

```typescript
openKBClient.available          // true si OPENKB_SERVICE_URL está definida
openKBClient.isHealthy()        // GET /health
openKBClient.addDocument(companyId, documentId, text)   // POST /api/v1/add
openKBClient.search(query, companyId)                   // POST /api/v1/search
```

---

## 5. PageIndex

### Qué es PageIndex
PageIndex (VectifyAI) extrae la estructura jerárquica de un PDF — equivalente a un índice/TOC semántico — y la guarda en Postgres. NO usa embeddings ni vectores.

### Cómo se usa en este proyecto
Cada nodo del árbol es una fila en `PageIndex`:
```
level 0: raíz del documento
level 1: capítulos / secciones principales
level 2: subsecciones
...
campos: title, content (texto hasta 10K chars), page, parentId
```

### Por qué PageIndex es clave
- El **dictamen IA** lee todos los nodos (`prisma.pageIndex.findMany`) y los ensambla con separadores para enviarlos a Kimi K2.6
- El **servicio Q&A** (`qa-service.ts`) busca en PageIndex por página/sección/keyword antes de llamar al LLM
- OpenKB recibe también el contenido de PageIndex al indexar (Phase 2)

### Archivos clave
- `src/lib/pageindex-real.ts` — implementación local con `pdfjs-dist`
- `src/lib/pageindex.ts` — re-export (`pageIndexService`)
- `src/lib/document-pipeline.ts:runIndexing()` — guarda en Postgres

---

## 6. Pipeline de procesamiento

### Phase 1: Indexación (`runIndexing`)
```
PDF en disco (local: ./uploads/<documentId>)
  ↓ pdfjs-dist (docs <50MB) o pdftotext (docs >50MB)
  ↓ PageIndex.buildIndex() → árbol jerárquico
  ↓ prisma.pageIndex.create() × N nodos
  ↓ document.status = INDEXED
```

### Phase 2: Análisis (`runAnalysis`)
```
pageIndex.findMany(documentId) → N nodos
  ↓ Ensamblar markdown con títulos y páginas
  ↓ openKBClient.addDocument(companyId, documentId, text)
      → POST /api/v1/add → openkb add_single_file()
      → wiki/sources/<documentId>.* guardado
      → concepts/ actualizados
  ↓ document.status = ANALYZED
  ↓ maybeScheduleAiDictamen(documentId)  ← trigger automático
```

> **Si OpenKB no está disponible**: el pipeline continúa, el documento queda `ANALYZED` igualmente. El Q&A fallará a `qaService` (PageIndex + NIM directo).

### Trigger del Dictamen IA
`maybeScheduleAiDictamen()` se llama tras cada Phase 2:
- Cuenta docs `PROCESSING` / `PENDING` de la empresa → si = 0, dispara `generateAiDictamen()`
- Evita generar si ya hay uno `GENERATING` (<10 min de edad)
- Evita regenerar si hay uno `READY` con <1h de antigüedad

---

## 7. Dictamen IA (el análisis principal)

### Qué hace
Lee **todos** los documentos ANALYZED/INDEXED de la empresa, los ensambla con separadores visuales en un único prompt, y los envía a Kimi K2.6 en una sola llamada.

### Por qué una sola llamada con separadores
Kimi K2.6 tiene contexto de **1 millón de tokens** (~4M chars). Para 4-10 documentos ESG típicos (cada uno ≤300K chars), todo cabe en un único prompt. Los separadores `═══` evitan que el modelo confunda el contenido entre documentos:

```
═════════════════════════════════════════════════════════════════════════
DOCUMENTO 1 DE 4
Nombre    : "Acta Constitutiva.pdf"
Tipo      : LEGAL
Secciones : 23
═════════════════════════════════════════════════════════════════════════

## Sección 1. Denominación social (pág. 1)
[contenido completo del PageIndex]

═════════════════════════════════════════════════════════════════════════
FIN DOCUMENTO 1 — "Acta Constitutiva.pdf"
═════════════════════════════════════════════════════════════════════════

DOCUMENTO 2 DE 4
...
```

### Salida
```json
{
  "vlap": {
    "vigencia":    { "suggestion": true,  "confidence": 85, "rationale": "..." },
    "legibilidad": { "suggestion": true,  "confidence": 90, "rationale": "..." },
    "autoria":     { "suggestion": false, "confidence": 70, "rationale": "..." },
    "pertinencia": { "suggestion": true,  "confidence": 95, "rationale": "..." }
  },
  "findings": [ { "type": "NON_COMPLIANCE", "severity": "HIGH", ... } ],
  "summary": "Resumen ejecutivo en 2-3 oraciones."
}
```

Guardado en tabla `AiDictamen` con `status: READY`.

### Modelos utilizados
| Variable | Modelo actual | Uso |
|----------|--------------|-----|
| `NVIDIA_INTENT_MODEL` | `moonshotai/kimi-k2.6` | Dictamen IA (llamada principal) |
| `NVIDIA_DEEPSEEK_MODEL` | `moonshotai/kimi-k2.6` | OpenKB + Q&A profundo |
| `NVIDIA_CHAT_MODEL` | `meta/llama-3.1-70b-instruct` | Q&A rápido / tree search |
| `NVIDIA_QA_MODEL` | `z-ai/glm4.7` | Q&A especializado |
| `NVIDIA_EMBEDDING_MODEL` | `nvidia/llama-nemotron-embed-1b-v2` | Embeddings (nim.ts) |

---

## 8. Flujo de negocio completo

```
1. EMPRESA
   └─ Se registra (email, companyName, industry, RFC)
   └─ Sube PDFs (acta constitutiva, estados financieros, políticas ESG, etc.)
   └─ Ve progreso del procesamiento en tiempo real (SSE / polling)

2. PIPELINE (automático)
   └─ Phase 1: PDF → PageIndex → Postgres (status: INDEXED)
   └─ Phase 2: PageIndex → OpenKB → (status: ANALYZED)
   └─ Trigger: todos los docs listos → genera AiDictamen con Kimi K2.6

3. ADMIN
   └─ Ve listado de empresas con sus documentos y el dictamen IA
   └─ Revisa datos de registro de la empresa
   └─ Asigna un Assessor ESG a la empresa

4. ASSESSOR (una vez asignado)
   └─ Ve los documentos de la empresa
   └─ Ve el dictamen preliminar de la IA (VLAP + hallazgos)
   └─ Puede hacer Q&A sobre cualquier documento (OpenKB o PageIndex+NIM)
   └─ Revisa y valida cada hallazgo de la IA
   └─ Emite o deniega el certificado ESG (CompanyCertification)
   └─ Si deniega: puede crear tickets CAPA (acciones correctivas, 30 días)

5. EMPRESA (post-dictamen)
   └─ Ve el resultado: APPROVED / REJECTED
   └─ Si hay CAPAs abiertos: los gestiona y cierra
   └─ Certificado ESG público con token único (publicToken)
```

---

## 9. Variables de entorno clave

```bash
# ── NVIDIA NIM ───────────────────────────────────────────────
NVIDIA_API_KEY=nvapi-...          # API key principal (pipeline + embeddings)
NVIDIA_INTENT_API_KEY=nvapi-...   # API key para dictamen IA (cuota separada)
NVIDIA_QA_API_KEY=nvapi-...       # API key para Q&A

NVIDIA_INTENT_MODEL=moonshotai/kimi-k2.6     # Dictamen IA
NVIDIA_DEEPSEEK_MODEL=moonshotai/kimi-k2.6   # OpenKB + Q&A profundo
NVIDIA_CHAT_MODEL=meta/llama-3.1-70b-instruct
NVIDIA_QA_MODEL=z-ai/glm4.7
NVIDIA_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-1b-v2

# ── Infraestructura ──────────────────────────────────────────
DATABASE_URL=postgresql://postgres:...@localhost:5434/economia_db
REDIS_HOST=localhost
REDIS_PORT=6379

# ── OpenKB ───────────────────────────────────────────────────
OPENKB_SERVICE_URL=http://localhost:8001   # URL del microservicio OpenKB

# ── PageIndex ────────────────────────────────────────────────
PAGEINDEX_LOCAL_MODE=true    # Usa pdfjs local (no API externa)

# ── Almacenamiento ───────────────────────────────────────────
LOCAL_STORAGE_PATH=./uploads  # Local ahora; GCS en Cloud Run

# ── App ──────────────────────────────────────────────────────
MAX_CHUNKS_TO_PROCESS=500
RATE_LIMIT_DISABLED=true      # false en producción
```

---

## 10. Archivos clave del proyecto

```
src/lib/
├── document-pipeline.ts      ★ Pipeline central (runIndexing + runAnalysis)
├── ai-dictamen-service.ts    ★ Dictamen IA con Kimi K2.6 + separadores
├── openkb-client.ts          ★ Cliente TypeScript para OpenKB API
├── pageindex-real.ts         ★ Implementación PageIndex (pdfjs local)
├── pageindex.ts              Re-export de pageindex-real
├── pipeline-types.ts         Tipos: CogneeDomain, ExtractionConfig
├── qa-service.ts             Q&A: PageIndex + NIM (fallback de OpenKB)
├── nim.ts                    Cliente NVIDIA NIM (LLM + embeddings)
├── storage.ts                Fachada de almacenamiento (local ahora, GCS futuro)
├── queue/index.ts            BullMQ: colas y workers
└── db.ts                     Prisma client

openkb-api/
├── main.py                   ★ FastAPI wrapper de OpenKB
├── requirements.txt          openkb>=0.1.3, fastapi, uvicorn
└── Dockerfile

src/app/api/
├── documents/[id]/
│   ├── process/route.ts      Procesar doc manualmente (escape hatch)
│   ├── search/route.ts       ★ Q&A: OpenKB → fallback qaService
│   └── progress/route.ts     SSE de progreso en tiempo real
├── capa/                     Tickets CAPA (acciones correctivas)
├── companies/[id]/
│   └── ai-dictamen/          API del dictamen IA
└── notifications/            Sistema de notificaciones
```

---

## 11. Plan de despliegue en Cloud Run

> Estado actual: **local** (docker-compose). El diseño ya contempla Cloud Run.

### Servicios Cloud Run planificados

```
cetiem-app        → Cloud Run (Next.js, stateless)
cetiem-workers    → Cloud Run Job (BullMQ workers, triggered)
cetiem-openkb     → Cloud Run (FastAPI OpenKB, con volume mount)
```

### Cambios necesarios para Cloud Run

| Componente | Local ahora | Cloud Run |
|-----------|-------------|-----------|
| PDFs (`./uploads/`) | Disco local | Cloud Storage (GCS) — `storage.ts` ya tiene la fachada lista |
| OpenKB KB (`/data/kb/`) | Docker volume | Cloud Storage FUSE mount o Cloud Filestore |
| PostgreSQL | Docker local | Cloud SQL (PostgreSQL) |
| Redis | Docker local | Cloud Memorystore (Redis) |
| Variables de entorno | `.env` | Secret Manager |

### Por qué `storage.ts` ya está preparado
`src/lib/storage.ts` expone una fachada con `getLocalPath()`, `saveFileWithId()`, `openReadStream()`. Cuando se migre a GCS, solo cambia la implementación interna — el pipeline no necesita cambios.

### Nota sobre OpenKB en Cloud Run
OpenKB escribe el wiki en disco (`/data/kb/`). En Cloud Run (stateless) necesita un volumen persistente:
- **Opción A**: Cloud Filestore NFS montado en el contenedor
- **Opción B**: Persistir el wiki en GCS con `gcsfuse` (script de arranque)
- **Opción C**: Migrar a una versión de OpenKB que soporte backends de almacenamiento cloud

---

## 12. Decisiones de arquitectura registradas

| Decisión | Razón |
|----------|-------|
| Una llamada LLM por empresa (no por documento) | Kimi K2.6 tiene 1M tokens; una sola llamada mantiene contexto cruzado entre documentos |
| Separadores `═══` en el prompt | El modelo confunde documentos sin delimitadores visuales claros |
| KB por `companyId` en OpenKB (no por `documentId`) | Permite razonamiento cross-documento igual que hacía FalkorDB |
| OpenKB es no-bloqueante en el pipeline | Si el contenedor OpenKB está caído, los docs se analizan igual; Q&A cae a PageIndex+NIM |
| `NVIDIA_INTENT_API_KEY` separado para el dictamen | Cuota independiente — evita que el pipeline de indexación agote la cuota del dictamen |
| `PAGEINDEX_LOCAL_MODE=true` | No dependemos de la API cloud de PageIndex; funciona offline con pdfjs |
| FalkorDB eliminado completamente | Complejidad de mantenimiento alta, dependencia extra, OpenKB cubre los casos de uso |

---

*Última actualización: Mayo 2026 — stack: PageIndex + OpenKB + Kimi K2.6 (NVIDIA NIM)*
