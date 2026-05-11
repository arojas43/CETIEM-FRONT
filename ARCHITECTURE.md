# CETIEM — Arquitectura de la Plataforma ESG

> Documentación técnica de referencia. Refleja el estado actual del stack tras la migración a **PageIndex + OpenKB** (FalkorDB y Cognee.ai eliminados completamente en Mayo 2026).

---

## Índice

1. [Visión general](#1-visión-general)
2. [Stack tecnológico](#2-stack-tecnológico)
3. [Servicios Docker](#3-servicios-docker)
4. [Servicio OpenKB](#4-servicio-openkb)
5. [PageIndex](#5-pageindex)
6. [Pipeline de procesamiento](#6-pipeline-de-procesamiento)
7. [Dictamen IA](#7-dictamen-ia)
8. [Sistema Q&A](#8-sistema-qa)
9. [Progreso en tiempo real (SSE)](#9-progreso-en-tiempo-real-sse)
10. [Control de acceso](#10-control-de-acceso)
11. [Flujo de negocio completo](#11-flujo-de-negocio-completo)
12. [Referencia de API](#12-referencia-de-api)
13. [Mapa frontend → backend](#13-mapa-frontend--backend)
14. [Variables de entorno](#14-variables-de-entorno)
15. [Archivos clave](#15-archivos-clave)
16. [Plan Cloud Run](#16-plan-cloud-run)
17. [Decisiones de arquitectura registradas](#17-decisiones-de-arquitectura-registradas)

---

## 1. Visión General

CETIEM permite a empresas obtener su certificación ESG del Programa CETIEM (Secretaría de Economía). La IA analiza los documentos, genera un dictamen preliminar VLAP y lo pone a disposición del Assessor ESG para que emita o deniegue el certificado.

```
Empresa sube PDFs
       ↓
Pipeline BullMQ: PageIndex → OpenKB
       ↓
Kimi K2.6 genera Dictamen IA (VLAP + hallazgos + resumen)
       ↓
Admin ve dictamen IA → asigna Assessor a la empresa
       ↓
Assessor revisa docs + Q&A con IA → emite/deniega certificado ESG
       ↓
Empresa descarga certificado o gestiona tickets CAPA
```

---

## 2. Stack Tecnológico

| Capa | Tecnología | Rol |
|------|-----------|-----|
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript 5.6 | UI multi-rol: empresa / assessor / admin |
| **Auth** | NextAuth.js v5 (JWT, CredentialsProvider, bcryptjs) | Sesiones, roles (COMPANY / ASSESSOR / ADMIN) |
| **Base de datos** | PostgreSQL 16 + Prisma 6 | Usuarios, documentos, PageIndex, dictámenes, certificados |
| **Cola de trabajo** | BullMQ + Redis 7 | Procesamiento asíncrono de documentos |
| **Progreso real-time** | SSE (text/event-stream) + Redis pub/sub | Barra de progreso en vivo durante el pipeline |
| **Indexación de docs** | PageIndex (implementación local, pdfjs) | Árbol jerárquico PDF → Postgres |
| **KB de conocimiento** | OpenKB (VectifyAI) + FastAPI wrapper | Wiki por empresa → Q&A cross-documento |
| **LLM principal** | Kimi K2.6 vía NVIDIA NIM (1M tokens) | Dictamen IA + Q&A profundo |
| **LLM auxiliar** | Llama 3.1 70B vía NVIDIA NIM | Q&A rápido, tree search PageIndex |
| **Almacenamiento** | Local (`./uploads/`) en dev | PDFs de empresas — GCS planificado para Cloud Run |
| **UI** | Tailwind CSS + SHADCN UI, dark theme CETIEM | Diseño glassmorphism, neon-green, Inter |

### Lo que SE ELIMINÓ y por qué

| Eliminado | Reemplazado por | Razón |
|-----------|----------------|-------|
| **FalkorDB** | OpenKB | Grafo de entidades → wiki cross-documento sin DB de grafos |
| **Cognee.ai** | OpenKB | Extracción de entidades LLM → compilación wiki OpenKB |
| `falkordb.ts` | — | 800 LOC de cliente FalkorDB, ya no necesario |
| `cognee-service.ts` | `pipeline-types.ts` | 700 LOC de extracción batch, solo se conservan los tipos |
| `large-document-batch.ts` | — | Batch processing para FalkorDB, obsoleto |
| `cognee-api/` (Python) | `openkb-api/` (Python) | Cognee.ai server → OpenKB FastAPI wrapper |
| Rutas `/api/graph/*` y `/api/documents/[id]/graph/*` | — | Consultas Cypher → OpenKB Q&A |
| Página `dashboard/graph` | — | Visualización FalkorDB, sin reemplazo UI |
| Panel "Grafo IA" en review | — | Mostraba entidades FalkorDB; removido en frontend |

---

## 3. Servicios Docker

```yaml
# docker-compose.yml — servicios activos
postgres:16-alpine    → Puerto 5434  (datos relacionales + PageIndex)
redis:7-alpine        → Puerto 6381  (BullMQ colas + pub/sub progreso)
openkb-api            → Puerto 8001  (KB wiki por empresa, Q&A)
app (Next.js)         → Puerto 3000  (interfaz web)
workers (BullMQ)      → interno      (procesamiento en background)
db-init               → one-shot     (prisma db push + seed)
```

### Arranque

```bash
cp .env.example .env          # Editar NVIDIA_API_KEY, NVIDIA_INTENT_API_KEY
docker compose up --build

# App:    http://localhost:3000
# OpenKB: http://localhost:8001/health
# Postgres (Prisma Studio): npx prisma studio → localhost:5555
```

---

## 4. Servicio OpenKB (`openkb-api/`)

### Qué es OpenKB

OpenKB (VectifyAI) construye un knowledge base wiki-style a partir de documentos. En lugar de un grafo de entidades, crea archivos Markdown interconectados por empresa:

```
/data/kb/<companyId>/
  wiki/
    index.md              ← índice central del KB de la empresa
    summaries/            ← resumen por documento (<documentId>.md)
    concepts/             ← páginas cross-documento (ej: "ISO 14001.md")
    sources/              ← contenido completo indexado
  .openkb/
    hashes.json           ← SHA-256 por archivo (evita reindexar sin cambios)
```

### Por qué un KB por empresa (no por documento)

El `companyId` es el `datasetName` del KB. Esto permite que OpenKB haga razonamiento **cross-documento**: si la empresa tiene 4 docs, OpenKB los sintetiza en páginas de conceptos (`concepts/`) que relacionan información entre ellos.

### Endpoints del microservicio (`openkb-api/main.py`)

```
POST /api/v1/add
  Form: data (file con nombre <documentId>.txt), datasetName (companyId)
  → Indexa el documento en el KB de la empresa
  → Hash SHA-256: evita reindexar si el contenido no cambió
  → Síncrono con timeout de 280s (asyncio.wait_for)
  → Responde: { "message": "ok", "title": "...", "filename": "..." }

POST /api/v1/search
  Body: { query, datasets: [companyId], top_k: 10 }
  → run_query() de OpenKB sobre el wiki de la empresa
  → Razonamiento sobre todos los documentos del KB
  → Responde: { "search_result": "...", "sources": [...] }
  → Lanza HTTPException(500) si falla (NO retorna error en 200)

DELETE /api/v1/documents/{document_id}?datasetName={companyId}
  → Elimina: wiki/sources/<documentId>.*, wiki/summaries/<documentId>.md
  → Elimina la entrada SHA-256 de .openkb/hashes.json
  → Idempotente: si el archivo no existe, responde 200 igualmente
  → Necesario para purgar wiki obsoleto antes de re-indexar

GET /health
  → { "status": "ok", "model": "openai/moonshotai/kimi-k2.6" }
```

### Cliente TypeScript: `src/lib/openkb-client.ts`

```typescript
openKBClient.available                                    // true si OPENKB_SERVICE_URL definida
openKBClient.isHealthy()                                  // GET /health
openKBClient.addDocument(companyId, documentId, text)     // POST /api/v1/add
openKBClient.search(query, companyId)                     // POST /api/v1/search
openKBClient.deleteDocument(companyId, documentId)        // DELETE /api/v1/documents/{id}
```

### Patrón delete-before-add (re-indexación)

Cuando un documento se reprocesa, el pipeline llama `deleteDocument()` antes de `addDocument()`. Sin esto, las páginas wiki anteriores (`summaries/`, `sources/`) quedarían huérfanas, contaminando las búsquedas con contenido obsoleto:

```typescript
// document-pipeline.ts — runAnalysis()
await openKBClient.deleteDocument(companyId, documentId).catch(() => {});  // fallo no crítico
await openKBClient.addDocument(companyId, documentId, docHeader + body);
```

---

## 5. PageIndex

### Qué es (nuestra implementación)

`src/lib/pageindex-real.ts` es una implementación **local** con `pdfjs-dist`. Extrae la estructura jerárquica de un PDF — equivalente a un índice/TOC semántico — y la guarda en Postgres. No es la biblioteca Python de VectifyAI; es TypeScript propio usando `pdfjs-dist` + NVIDIA NIM para detección de estructura.

### Árbol jerárquico en Postgres

Cada nodo del árbol es una fila en la tabla `PageIndex`:

```
level 0: raíz del documento
level 1: capítulos / secciones principales
level 2: subsecciones
...
campos: id, documentId, title, content (hasta 10K chars), page, parentId, metadata, level
```

### Usos del PageIndex una vez construido

1. **Dictamen IA** — `ai-dictamen-service.ts` hace `prisma.pageIndex.findMany()` y ensambla todos los nodos en un único prompt para Kimi K2.6
2. **Q&A fallback** — `qa-service.ts` busca en PageIndex por página/sección/keyword antes de llamar al LLM cuando OpenKB no está disponible
3. **OpenKB** — `runAnalysis()` convierte los nodos a markdown y los envía a OpenKB para construir el wiki
4. **Vista "Contenido"** — la página `/dashboard/documents/[id]/content` muestra el árbol completo al assessor

### Documentos grandes (>50MB)

Para PDFs >50MB, `pdfjs` es demasiado lento. Se usa `pdftotext` (poppler) vía `large-document-pdftotext.ts`, que extrae texto plano y crea chunks lineales (sin árbol jerárquico).

---

## 6. Pipeline de Procesamiento

### Entrada

```
POST /api/documents
  → Valida tipo (PDF) y tamaño
  → Guarda en ./uploads/<documentId>/<name>.pdf
  → Calcula SHA-256 del archivo
  → Crea documento con status=PENDING
  → AuditLog: DOCUMENT_UPLOADED
  → Encola en BullMQ (automático)
```

### Phase 1: `runIndexing(documentId)` — `document-pipeline.ts`

```
PDF en disco
  ↓ (si < 50MB) pdfjs-dist extrae texto por página
    PageIndex.buildIndex() → árbol jerárquico de secciones
    prisma.pageIndex.create() × N nodos (batches de 50)
    status = INDEXED

  ↓ (si > 50MB) pdftotext (poppler) extrae texto plano
    Divide en chunks de ~10K chars
    Guarda como nodos planos (level 1, sin jerarquía)
    status = INDEXED
```

### Phase 2: `runAnalysis(documentId)` — `document-pipeline.ts`

```
pageIndex.findMany(documentId, ordenados por level + page)
  ↓ Filtra nodos con content > 20 chars
  ↓ Ensambla markdown: "## {title} (p.{page})\n{content}"
  ↓ openKBClient.deleteDocument(companyId, documentId)  ← purga wiki anterior
  ↓ openKBClient.addDocument(companyId, documentId, markdown)
      → POST /api/v1/add → wiki/sources/<documentId>.*
      → wiki/concepts/ y wiki/summaries/ actualizados
  ↓ status = ANALYZED
  ↓ publishProgress(documentId, { step, percentage: 100, status: 'ANALYZED' })
  ↓ maybeScheduleAiDictamen(documentId)  ← trigger automático

  > Si OpenKB no está disponible: continúa, status=ANALYZED igualmente.
  > Q&A fallará a PageIndex+NIM hasta que OpenKB vuelva.
```

### Progreso y eventos Redis

`updateProgress()` escribe en Postgres Y publica en Redis:

```typescript
// Cada actualización de progreso:
await prisma.document.update({ data: { processingProgress: { step, percentage } } });
await publishProgress(documentId, { step, percentage, details });
// Redis PUBLISH doc:progress:{documentId} '{"step":"...", "percentage":55}'
```

### Workers BullMQ — `src/lib/queue/index.ts`

```
Cola "document-indexing"  → runIndexing(documentId)  → encola "document-analysis"
Cola "document-analysis"  → runAnalysis(documentId)  → maybeScheduleAiDictamen()
```

### Escape hatch síncrono

`/api/documents/[id]/process` llama a `runFullPipeline()` directamente, sin cola. Útil cuando Redis está caído o para reprocesamiento manual por Assessor/Admin.

---

## 7. Dictamen IA

### `ai-dictamen-service.ts`

`maybeScheduleAiDictamen(documentId)` es el trigger:
1. Cuenta docs `PENDING`/`PROCESSING` de la empresa → si = 0, genera
2. No genera si ya hay un `AiDictamen` con `status=GENERATING` y <10 min de edad
3. No regenera si hay uno `READY` con <1h de antigüedad

### Assembler del prompt

Lee **todos** los documentos ANALYZED/INDEXED de la empresa y los ensambla con separadores visuales para que Kimi K2.6 no confunda documentos:

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
```

Kimi K2.6 tiene contexto de **1 millón de tokens** (~4M chars). Para 4-10 documentos ESG típicos cabe en una sola llamada, lo que preserva contexto cruzado entre documentos.

### Salida JSON esperada

```json
{
  "vlap": {
    "vigencia":    { "suggestion": true,  "confidence": 85, "rationale": "..." },
    "legibilidad": { "suggestion": true,  "confidence": 90, "rationale": "..." },
    "autoria":     { "suggestion": false, "confidence": 70, "rationale": "..." },
    "pertinencia": { "suggestion": true,  "confidence": 95, "rationale": "..." }
  },
  "findings": [
    { "type": "NON_COMPLIANCE", "severity": "HIGH", "title": "...", "description": "...", "page": 12 }
  ],
  "summary": "Resumen ejecutivo en 2-3 oraciones."
}
```

Guardado en tabla `AiDictamen` con `status: READY`. El Assessor lo ve como punto de partida en la consola de revisión.

### Modelos NVIDIA NIM utilizados

| Variable de entorno | Modelo | Uso |
|---------------------|--------|-----|
| `NVIDIA_INTENT_MODEL` | `moonshotai/kimi-k2.6` | Dictamen IA (llamada principal, 1M tokens) |
| `NVIDIA_DEEPSEEK_MODEL` | `moonshotai/kimi-k2.6` | OpenKB backend + Q&A profundo |
| `NVIDIA_CHAT_MODEL` | `meta/llama-3.1-70b-instruct` | Q&A rápido / tree search |
| `NVIDIA_QA_MODEL` | `z-ai/glm4.7` | Q&A especializado |
| `NVIDIA_EMBEDDING_MODEL` | `nvidia/llama-nemotron-embed-1b-v2` | Embeddings (`nim.ts`) |

---

## 8. Sistema Q&A

`src/lib/qa-service.ts` implementa la estrategia de búsqueda en dos capas:

### Capa 1: OpenKB (preferida)

```typescript
// src/app/api/documents/[id]/search/route.ts
const openkbResult = await openKBClient.search(query, companyId);
if (openkbResult.answer && openkbResult.answer.length > 20) {
  return { answer: openkbResult.answer, sources: openkbResult.sources, engine: 'openkb' };
}
// Si OpenKB retorna vacío o lanza error → fallback a Capa 2
```

OpenKB hace razonamiento sobre el wiki completo de la empresa — puede responder preguntas que cruzan múltiples documentos.

### Capa 2: PageIndex + NIM (fallback)

```typescript
// Si OpenKB no disponible o falla:
const qaResult = await qaService.query(query, documentId);
// qaService busca en prisma.pageIndex por relevancia de texto
// luego llama a Llama 3.1 70B con los nodos encontrados como contexto
return { answer: qaResult.answer, sources: qaResult.sources, engine: 'pageindex' };
```

### Cuándo falla el fallback

Si PageIndex también falla (doc no indexado, NIM sin cuota), la ruta devuelve `{ answer: "No se encontró información...", engine: 'error' }` con HTTP 200 para no romper el UI del Assessor.

---

## 9. Progreso en Tiempo Real (SSE)

### Arquitectura

```
document-pipeline.ts         Redis pub/sub                  Browser
  updateProgress()    →   PUBLISH doc:progress:{id}  →   EventSource
  publishProgress()          canal Redis               /api/documents/[id]/progress
```

### Backend: `src/app/api/documents/[id]/progress/route.ts`

```typescript
// GET /api/documents/[id]/progress — SSE endpoint
// Headers: Content-Type: text/event-stream, Cache-Control: no-cache
// Se suscribe a Redis canal doc:progress:{documentId}
// Por cada mensaje: escribe "data: {json}\n\n" al stream
// Si Accept: application/json → devuelve snapshot del Postgres (compat. polling)
```

### Frontend: `src/components/processing-progress.tsx`

```typescript
const es = new EventSource(`/api/documents/${documentId}/progress`);
es.onmessage = (event) => {
  const data = JSON.parse(event.data);  // { step, percentage, status, details }
  setProgress(data);
  if (data.status === 'ANALYZED' || data.status === 'FAILED') es.close();
};
// Fallback: si EventSource no está soportado → polling con setInterval(fetch, 3000)
```

---

## 10. Control de Acceso

`src/lib/access.ts` centraliza la lógica de autorización. Todas las rutas API la usan:

```typescript
canAccessDocument(documentUserId, session):
  ADMIN   → siempre permitido
  COMPANY → solo si documentUserId === session.user.id
  ASSESSOR → solo si document.owner.assessorId === session.user.id

canAccessCompany(companyId, session):
  ADMIN   → siempre permitido
  COMPANY → solo si companyId === session.user.id
  ASSESSOR → solo si company.assessorId === session.user.id
```

Un assessor que intenta acceder a recursos de una empresa no asignada recibe `403 Forbidden` a nivel de API.

### Rate limiting: `src/lib/rate-limit.ts`

Usa `rate-limiter-flexible` con `RateLimiterRedis` reutilizando la conexión Redis de BullMQ:

| Ruta | Límite |
|------|--------|
| `/api/auth/register` | 5/min/IP |
| `POST /api/documents` | 20/hora/user |
| `POST /api/documents/[id]/process` | 10/hora/user |
| `POST /api/documents/[id]/search` | 60/min/user |

Responde `429` con headers `Retry-After`, `X-RateLimit-Remaining`, `X-RateLimit-Reset`.
`RATE_LIMIT_DISABLED=true` deshabilita en entornos de testing.

---

## 11. Flujo de Negocio Completo

```
1. EMPRESA
   └─ Se registra en /register (email, companyName, track A/B/C)
   └─ Sube PDFs en /dashboard/upload (max 50MB, solo PDF)
   └─ Ve progreso en tiempo real (SSE EventSource)

2. PIPELINE (automático, BullMQ)
   └─ Phase 1: PDF → PageIndex → Postgres (status: INDEXED)
   └─ Phase 2: PageIndex → OpenKB wiki (status: ANALYZED)
   └─ Trigger: todos los docs listos → AiDictamen con Kimi K2.6

3. ADMIN
   └─ Ve empresas con dictámenes IA en /dashboard/companies
   └─ Asigna un Assessor ESG a cada empresa

4. ASSESSOR (una vez asignado)
   └─ Ve cola de revisión en /dashboard/queue
   └─ Abre consola /dashboard/review/company/[id]
   └─ Lee el Dictamen IA preliminar (VLAP + hallazgos de Kimi K2.6)
   └─ Hace Q&A sobre documentos (OpenKB → PageIndex+NIM)
   └─ Valida/ajusta cada criterio VLAP y hallazgos
   └─ Emite veredicto: APPROVED / CHANGES_REQUESTED / REJECTED
   └─ Si NON_COMPLIANCE → CAPA tickets 30 días (automático)

5. EMPRESA (post-dictamen)
   └─ Ve resultado en /dashboard/documents/[id] → "Dictamen IA" card
   └─ APPROVED → descarga Certificado ESG (HTML + SHA-256 + UUID)
   └─ CAPA_OPEN → gestiona tickets en /dashboard/capa
   └─ REJECTED → debe corregir documentos y re-subir

6. ADMIN (kill-switch)
   └─ Puede revocar cualquier certificado APPROVED con razón documentada
   └─ AuditLog: CERT_REVOKED
```

---

## 12. Referencia de API

### Documentos

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/documents` | Todos | Lista documentos del usuario (o todos si Admin) |
| `POST` | `/api/documents` | COMPANY | Sube nuevo PDF |
| `GET` | `/api/documents/[id]` | Todos | Detalle del documento |
| `POST` | `/api/documents/[id]/process` | ASSESSOR/ADMIN | Reprocesa manualmente (escape hatch) |
| `GET` | `/api/documents/[id]/progress` | Todos | SSE de progreso en tiempo real |
| `GET` | `/api/documents/[id]/content` | Todos | Árbol PageIndex completo (texto estructurado) |
| `POST` | `/api/documents/[id]/search` | ASSESSOR/ADMIN | Q&A: OpenKB → fallback PageIndex+NIM |
| `PATCH` | `/api/documents/[id]/domain` | ASSESSOR/ADMIN | Cambia el dominio (INDUSTRIA/CONSTRUCCION/TECNOLOGIA) |
| `GET` | `/api/documents/[id]/certifications` | Todos | Cert actual del documento |
| `POST` | `/api/documents/[id]/certifications` | ASSESSOR/ADMIN | Emite o actualiza dictamen |
| `DELETE` | `/api/documents/[id]/certifications` | ADMIN | Revoca certificado (kill-switch) |
| `GET` | `/api/documents/[id]/certificate` | Todos | HTML del certificado ESG (solo APPROVED) |
| `GET` | `/api/files/[documentId]/[filename]` | Todos | Descarga el PDF original |

### Empresas

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/companies` | ASSESSOR/ADMIN | Lista empresas (ASSESSOR: solo asignadas) |
| `GET` | `/api/companies/[id]` | Todos | Detalle de empresa |
| `PATCH` | `/api/companies/[id]/assign` | ADMIN | Asigna assessor a empresa |
| `GET` | `/api/companies/[id]/ai-dictamen` | ASSESSOR/ADMIN | Dictamen IA de la empresa |
| `GET` | `/api/companies/[id]/certificate` | Todos | Certificado ESG de la empresa |
| `GET` | `/api/companies/[id]/certification` | Todos | Estado de certificación |

### Assessors

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/assessors` | ADMIN | Lista todos los assessors |
| `POST` | `/api/assessors` | ADMIN | Crea nuevo assessor |
| `GET` | `/api/assessors/list` | ADMIN | Lista simplificada para dropdowns |

### CAPA, Auditoría y otros

| Método | Ruta | Auth | Descripción |
|--------|------|------|-------------|
| `GET` | `/api/capa` | Todos | Lista tickets CAPA (filtrado por rol) |
| `PATCH` | `/api/capa/[id]` | Todos | Actualiza estado ticket CAPA |
| `GET` | `/api/audit` | ADMIN | Audit log paginado |
| `GET` | `/api/export/documents` | ASSESSOR/ADMIN | CSV de documentos |
| `GET` | `/api/dashboard/pulse` | Todos | Stats del dashboard |
| `GET` | `/api/notifications` | Todos | Notificaciones del usuario |
| `POST` | `/api/auth/register` | Público | Registro de empresa |

---

## 13. Mapa Frontend → Backend

### Páginas Empresa (COMPANY)

```
/dashboard
  ← GET /api/dashboard/pulse

/dashboard/upload
  → POST /api/documents (FormData: file, name, description)

/dashboard/documents
  ← GET /api/documents

/dashboard/documents/[id]
  ← GET /api/documents/[id]
  ← GET /api/documents/[id]/certifications
  → [Preguntar] POST /api/documents/[id]/search (solo ASSESSOR/ADMIN)
  ← [SSE progreso] GET /api/documents/[id]/progress
  → [Descargar cert] GET /api/documents/[id]/certificate (solo si APPROVED)
  → [Dictamen IA card] link a /dashboard/review/company/{document.userId}

/dashboard/capa
  ← GET /api/capa
  → PATCH /api/capa/[id] { status, resolution }

/dashboard/mi-certificado
  ← GET /api/companies/[userId]/certificate
```

### Páginas Assessor (ASSESSOR)

```
/dashboard
  ← GET /api/dashboard/pulse

/dashboard/queue
  ← GET /api/documents (ANALYZED/INDEXED, empresas asignadas)

/dashboard/review/company/[companyId]
  ← GET /api/companies/[companyId]
  ← GET /api/documents (filtrado por company)
  ← GET /api/companies/[companyId]/ai-dictamen
  → POST /api/documents/[id]/certifications (emitir dictamen)
  → [Q&A] POST /api/documents/[id]/search
  → [Reprocesar] POST /api/documents/[id]/process

/dashboard/review/[documentId]   ← vista de documento individual
  ← GET /api/documents/[id]
  ← GET /api/documents/[id]/certifications
  → POST /api/documents/[id]/certifications
  → POST /api/documents/[id]/search (Q&A)

/dashboard/documents/[id]
  ← GET /api/documents/[id]
  ← GET /api/documents/[id]/certifications
  → POST /api/documents/[id]/process
  → POST /api/documents/[id]/search (Q&A)

/dashboard/documents/[id]/content
  ← GET /api/documents/[id]/content  (árbol PageIndex)

/dashboard/companies
  ← GET /api/companies (solo asignadas)
```

### Páginas Admin (ADMIN)

```
/dashboard
  ← GET /api/dashboard/pulse (stats globales)

/dashboard/companies
  ← GET /api/companies (todas)
  ← GET /api/assessors/list
  → PATCH /api/companies/[id]/assign { assessorId }

/dashboard/assessors
  ← GET /api/assessors
  → POST /api/assessors

/dashboard/logs
  ← GET /api/audit?page=1&limit=20
  → [CSV] GET /api/export/documents

/dashboard/documents/[id]   (con kill-switch)
  → DELETE /api/documents/[id]/certifications { reason }
```

---

## 14. Variables de Entorno

```bash
# ── NVIDIA NIM ───────────────────────────────────────────────
NVIDIA_API_KEY=nvapi-...           # API key principal (pipeline + embeddings)
NVIDIA_INTENT_API_KEY=nvapi-...    # API key para dictamen IA (cuota separada)
NVIDIA_QA_API_KEY=nvapi-...        # API key para Q&A (puede ser la misma)

NVIDIA_INTENT_MODEL=moonshotai/kimi-k2.6       # Dictamen IA (1M tokens)
NVIDIA_DEEPSEEK_MODEL=moonshotai/kimi-k2.6     # OpenKB + Q&A profundo
NVIDIA_CHAT_MODEL=meta/llama-3.1-70b-instruct  # Q&A rápido / tree search
NVIDIA_QA_MODEL=z-ai/glm4.7                    # Q&A especializado
NVIDIA_EMBEDDING_MODEL=nvidia/llama-nemotron-embed-1b-v2

# ── Infraestructura ──────────────────────────────────────────
DATABASE_URL=postgresql://postgres:postgres@postgres:5434/economia_db
REDIS_HOST=redis
REDIS_PORT=6381

# ── OpenKB ───────────────────────────────────────────────────
OPENKB_SERVICE_URL=http://openkb-api:8001   # URL del microservicio OpenKB

# ── PageIndex ────────────────────────────────────────────────
PAGEINDEX_LOCAL_MODE=true    # Usa pdfjs local (no API externa de VectifyAI)

# ── Almacenamiento ───────────────────────────────────────────
LOCAL_STORAGE_PATH=./uploads   # Local ahora; GCS en Cloud Run

# ── App ──────────────────────────────────────────────────────
NEXTAUTH_SECRET=...            # openssl rand -base64 32
AUTH_SECRET=...                # igual que NEXTAUTH_SECRET
NEXTAUTH_URL=http://localhost:3000
MAX_CHUNKS_TO_PROCESS=500
RATE_LIMIT_DISABLED=true       # false en producción
```

---

## 15. Archivos Clave

```
src/lib/
├── document-pipeline.ts       ★ Pipeline central (runIndexing + runAnalysis + runFullPipeline)
├── ai-dictamen-service.ts     ★ Dictamen IA: assembler de prompt + llamada a Kimi K2.6
├── openkb-client.ts           ★ Cliente TypeScript para OpenKB API (add/search/delete)
├── pageindex-real.ts          ★ Implementación PageIndex (pdfjs-dist local)
├── pageindex.ts               Re-export de pageindex-real (pageIndexService)
├── qa-service.ts              Q&A: búsqueda en PageIndex + llamada a NIM (fallback)
├── nim.ts                     Cliente NVIDIA NIM (LLM + embeddings)
├── progress-publisher.ts      Redis PUBLISH para SSE de progreso
├── storage.ts                 Fachada de almacenamiento (local ahora, GCS futuro)
├── local-storage.ts           Implementación local de storage (backend interno)
├── large-document-pdftotext.ts  Extracción pdftotext para PDFs > 50MB
├── large-document-types.ts    Tipos para large document processing
├── pipeline-types.ts          Tipos: CogneeDomain, ExtractionConfig
├── process-document-service.ts Proxy a runFullPipeline (compatibilidad)
├── rate-limit.ts              Rate limiting con rate-limiter-flexible + Redis
├── access.ts                  canAccessDocument / canAccessCompany
├── audit.ts                   logAudit() — registros inmutables
├── auth.ts                    Configuración NextAuth v5
├── db.ts                      Prisma client singleton
├── notify.ts                  Sistema de notificaciones in-app
├── esg-score.ts               Cálculo de ESG Score desde VLAP
├── document-catalogue.ts      Tipos de documento ESG reconocibles
├── utils.ts                   cn() y utilidades Tailwind
└── queue/
    └── index.ts               BullMQ: definición de colas y workers

openkb-api/
├── main.py                    ★ FastAPI wrapper de OpenKB (add/search/delete/health)
├── requirements.txt           openkb>=0.1.3, fastapi, uvicorn, python-multipart
└── Dockerfile

src/app/api/
├── documents/
│   ├── route.ts               GET (lista) + POST (upload)
│   └── [id]/
│       ├── route.ts           GET (detalle)
│       ├── process/           POST: reprocesamiento manual
│       ├── progress/          GET: SSE de progreso (Redis sub → stream)
│       ├── content/           GET: árbol PageIndex completo
│       ├── search/            POST: Q&A (OpenKB → PageIndex+NIM)
│       ├── domain/            PATCH: cambio de dominio IA
│       ├── certifications/    GET + POST + DELETE: dictamen + kill-switch
│       └── certificate/       GET: HTML certificado ESG
├── companies/[id]/
│   ├── route.ts               GET: detalle empresa
│   ├── assign/                PATCH: asignar assessor (Admin)
│   ├── ai-dictamen/           GET: dictamen IA de la empresa
│   ├── certificate/           GET: certificado ESG de la empresa
│   └── certification/         GET: estado de certificación
├── assessors/                 GET lista + POST crear (Admin)
├── capa/                      GET lista + PATCH por id
├── audit/                     GET log (Admin)
├── export/documents/          GET CSV
├── files/[documentId]/[filename]/ GET: descarga PDF original
├── notifications/             GET: notificaciones in-app
├── dashboard/pulse/           GET: stats del dashboard
└── auth/
    ├── register/              POST: registro empresa
    └── [...nextauth]/         NextAuth handlers
```

---

## 16. Plan Cloud Run

> Estado actual: **local** (docker-compose). El diseño ya contempla Cloud Run.

### Servicios planificados

```
cetiem-app        → Cloud Run (Next.js, stateless)
cetiem-workers    → Cloud Run Job (BullMQ workers, triggered por Pub/Sub)
cetiem-openkb     → Cloud Run (FastAPI OpenKB, con volume mount)
```

### Cambios necesarios

| Componente | Local | Cloud Run |
|-----------|-------|-----------|
| PDFs (`./uploads/`) | Disco local | Google Cloud Storage — `storage.ts` ya tiene la fachada |
| OpenKB KB (`/data/kb/`) | Docker volume | Cloud Storage FUSE o Cloud Filestore NFS |
| PostgreSQL | Docker local | Cloud SQL (PostgreSQL) |
| Redis | Docker local | Cloud Memorystore (Redis) |
| Variables de entorno | `.env` | Secret Manager |

`storage.ts` expone `getLocalPath()`, `saveFileWithId()`, `openReadStream()`. Cuando se migre a GCS, solo cambia la implementación interna — el pipeline y las rutas API no necesitan cambios.

---

## 17. Decisiones de Arquitectura Registradas

| Decisión | Razón |
|----------|-------|
| Una llamada LLM por empresa (no por documento) | Kimi K2.6 tiene 1M tokens; una sola llamada mantiene contexto cruzado entre documentos |
| Separadores `═══` en el prompt del dictamen | El modelo confunde documentos sin delimitadores visuales claros |
| KB por `companyId` en OpenKB (no por `documentId`) | Permite razonamiento cross-documento igual que hacía FalkorDB |
| Delete-before-add en OpenKB | Sin esto, las páginas wiki anteriores quedan huérfanas contaminando búsquedas futuras |
| OpenKB es no-bloqueante en el pipeline | Si el contenedor cae, los docs se analizan igual; Q&A cae a PageIndex+NIM |
| `NVIDIA_INTENT_API_KEY` separado | Cuota independiente — el pipeline de indexación no agota la cuota del dictamen |
| `PAGEINDEX_LOCAL_MODE=true` | No dependemos de la API cloud de VectifyAI; funciona offline con pdfjs |
| pdftotext para docs >50MB | pdfjs es demasiado lento para PDFs grandes; poppler es mucho más rápido |
| SSE para progreso (no polling) | Menos carga en Postgres; el pipeline publica en Redis, el browser recibe push |
| FalkorDB + Cognee eliminados | Complejidad de mantenimiento alta, dependencias extra, OpenKB cubre los casos de uso |
| Escape hatch síncrono (`/process`) | Cuando Redis está caído, los Assessors pueden reprocesar manualmente sin depender de la cola |

---

*Última actualización: Mayo 2026 — stack: PageIndex + OpenKB + Kimi K2.6 (NVIDIA NIM)*
