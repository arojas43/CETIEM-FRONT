# Validación de funcionalidades — CETIEM Platform

Registro de revisión técnica del sistema. Fecha: 2026-03-24.

---

## Usuarios de prueba — verificados ✅

Creados con `npx prisma db seed` (contraseña: `cetiem2024`):

| Email | Rol | ID |
|-------|-----|----|
| admin@cetiem.mx | ADMIN | cuid generado |
| assessor@cetiem.mx | ASSESSOR | cuid generado |
| empresa1@cetiem.mx | COMPANY | cuid generado |
| empresa2@cetiem.mx | COMPANY | cuid generado |

Verificación: la seed usa `upsert` — es idempotente, se puede correr múltiples veces sin duplicar.

---

## Autenticación

### ✅ Login (`/auth/signin`)
- Archivo: `src/app/auth/signin/page.tsx` + `src/components/auth.tsx`
- Verifica sesión activa (server) → redirige al dashboard si ya autenticado
- `SignInPage` llama a `signIn("credentials", { email, password, redirect: false })`
- NextAuth `authorize` en `src/lib/auth.ts`: busca usuario en BD, compara con `bcrypt.compare`
- JWT callback: añade `token.id` y `token.role`
- Session callback: expone `session.user.id` y `session.user.role`
- **Sin credenciales hardcodeadas** — campos vacíos, placeholder genérico
- Link "Registra tu empresa" → `/register`

### ✅ Registro (`/register`)
- Archivo: `src/app/register/page.tsx`
- Paso 1: datos empresa (companyName, rfc, industry, phone, contactName, email, password)
- Paso 2: selector de tipos de certificación (UI, no persistido aún)
- Paso 3: pantalla de éxito con próximos pasos
- Conectado a `POST /api/auth/register`:
  - Valida campos obligatorios, longitud mínima de contraseña
  - Verifica email duplicado (409 si ya existe)
  - Hash bcrypt con factor 10
  - Crea usuario con `role: COMPANY`

### ✅ Protección de rutas
- `src/app/dashboard/layout.tsx`: `auth()` server-side → `redirect('/auth/signin')` si no hay sesión
- `src/app/auth/signin/page.tsx`: `auth()` → `redirect('/dashboard')` si ya hay sesión

---

## Dashboard por rol

### ✅ RoleContext sincronizado con sesión
- Archivo: `src/lib/role-context.tsx`, `src/app/dashboard/layout.tsx`
- Layout obtiene `session.user.role` (server), pasa como `defaultRole` a `RoleProvider`
- `RoleProvider` recibe `defaultRole`, lo aplica y lo persiste en localStorage
- `useRole()` en cualquier componente cliente retorna el rol real del usuario
- Sin necesidad de selección manual de rol en producción

### ✅ Dashboard COMPANY
- 4-step progress tracker (Registro → Documentos → Análisis IA → Certificación)
- KPIs: total docs, procesando, analizados, certificados
- Lista de documentos recientes con estado

### ✅ Dashboard ASSESSOR
- KPIs: cola total, analizados, en revisión, completados
- Lista de documentos con botón "Revisar" → `/dashboard/review/[id]`
- Feed de actividad reciente

### ✅ Dashboard ADMIN
- 5 KPI cards: total empresas, assessors, documentos, en proceso, analizados
- Tabla de empresas con documentos
- Log de actividad global

### ✅ Sidebar por rol
- `src/components/sidebar.tsx`
- `NAV_BY_ROLE` record define ítems distintos para COMPANY / ASSESSOR / ADMIN
- Company: Dashboard, Mis Documentos, Subir, Mi Certificación (disabled), Grafo, Soporte (disabled)
- Assessor: Dashboard, Cola de Revisión (badge NEW), Empresas Asignadas, Documentos, Grafo, Historial
- Admin: Dashboard, Empresas, Assessors, Documentos, Grafo, Métricas, Logs, Configuración

---

## Documentos

### ✅ Upload (`/dashboard/upload`)
- Drag-and-drop (react-dropzone)
- Validación: solo PDF, tamaño máximo
- `POST /api/documents` → guarda en `uploads/{id}/{id}.pdf`, crea registro en BD
- BullMQ encola job de procesamiento
- Redirige a dashboard tras éxito

### ✅ Lista paginada (`/dashboard/documents`)
- `GET /api/documents?page=&limit=&status=&search=`
- Solo documentos del usuario autenticado (`userId: session.user.id`)
- Paginación: hasta 100 por página

### ✅ CRUD de documentos
- `GET /api/documents/[id]` — cualquier usuario autenticado (para consola de revisión)
- `DELETE /api/documents/[id]` — solo el dueño, elimina archivo local + registro
- `PATCH /api/documents/[id]` — solo el dueño, actualiza name/description

### ✅ Servir archivos
- `GET /api/files/[documentId]/[filename]`
- Lee de `uploads/{documentId}/{filename}` (o `LOCAL_STORAGE_PATH`)
- Content-Type automático según extensión
- `Content-Disposition: inline` para renderizar PDF en iframe

---

## Procesamiento IA

### ✅ Pipeline
- `src/lib/process-document-service.ts` orquesta:
  1. Extracción texto: `pdf-parse` → fallback OCR Tesseract
  2. Chunking: 3500 chars por chunk
  3. PageIndex: jerarquía de secciones → BD (`PageIndex` model)
  4. Cognee: extracción entidades/relaciones → FalkorDB
- Modos: Auto / Mixto / Dirigido (config personalizable desde UI)
- `processingProgress` (JSON) actualizado en cada paso

### ✅ API de procesamiento
- `POST /api/documents/[id]/process` — recibe `domain`, `extractionConfig`
- `GET /api/documents/[id]/progress` — estado actual del procesamiento

---

## Q&A Semántico

### ✅ Estrategia de búsqueda
- `src/lib/qa-service.ts`
- Búsqueda LLM tree (hasta 20 secciones) + keyword search (hasta 25) en **paralelo** (`Promise.all`)
- Resultados merged y deduplicados por `{section}|{page}`
- Contexto enviado al LLM con referencias de página/sección

### ✅ Modelo GLM4.7
- `src/lib/qwen-qa.ts`
- Endpoint: NVIDIA NIM `z-ai/glm4.7`
- `temperature: 1, top_p: 1, max_tokens: 16384`
- `chat_template_kwargs: { enable_thinking: true, clear_thinking: false }`
- System prompt con instrucción explícita: "Responde SIEMPRE en español"
- Retry automático (1 reintento con 2s de espera)

---

## Grafo de conocimiento

### ✅ Por documento
- `GET /api/documents/[id]/graph` — entidades y relaciones del documento
- `GET /api/documents/[id]/graph/debug` — inspección completa del grafo

### ✅ Global
- `POST /api/graph/query` — Cypher query con sanitización (bloquea DROP, DELETE ALL)
- `GET /api/graph/query` — estadísticas globales del grafo

---

## Flujo de auditoría

### ✅ Cola de revisión (`/dashboard/queue`)
- Muestra todos los documentos con status `ANALYZED` o `INDEXED`
- Ordenados por `updatedAt DESC`
- Botón "Iniciar Revisión" → `/dashboard/review/[id]`
- Botón "Ver detalles" → `/dashboard/documents/[id]`

### ✅ Consola split-view (`/dashboard/review/[id]`)
- Fetches `GET /api/documents/[id]` para metadatos
- PDF URL: `/api/files/{id}/{id}.pdf` (correcto: archivos se guardan como `{id}.pdf`)
- Panel izquierdo: `<iframe>` PDF nativo del browser
- Panel derecho: formulario de auditoría
  - Info del documento: empresa, dominio, estado IA, descripción
  - Hallazgos: tipo (COMPLIANCE/NON_COMPLIANCE/OBSERVATION), severidad (LOW/MEDIUM/HIGH/CRITICAL), título, descripción, página
  - Notas generales textarea
  - Veredicto con color semántico: Aprobar (lime) / Solicitar Cambios (amber) / Rechazar (red)
  - Botón "Emitir Dictamen" (habilitado solo si hay veredicto)

### ⚠️ Persistencia del dictamen — PENDIENTE
- `handleSave` simula con `setTimeout(800ms)`
- Los modelos `Certification` y `Finding` existen en el schema — falta el API endpoint `POST /api/documents/[id]/certifications`

---

## Gestión de empresas (Admin)

### ✅ Listado de empresas (`/dashboard/companies`)
- Filtrado por `role: "COMPANY"` (fix aplicado — antes traía todos los usuarios)
- Muestra documentos por empresa con estado
- Badge de estado de certificación: READY / IN_PROGRESS / PENDING / NO_DOCS / ISSUE
- Botón "Revisar" para documentos ANALYZED/INDEXED

---

## Bugs encontrados y corregidos durante la validación

| Bug | Archivo | Fix aplicado |
|-----|---------|--------------|
| Companies page traía todos los usuarios (admins, assessors) | `src/app/dashboard/companies/page.tsx` | Añadido `where: { role: "COMPANY" }` |
| Login tenía credenciales hardcodeadas en campos | `src/components/auth.tsx` | Campos vaciados, placeholder genérico |
| RoleContext no sincronizaba con sesión real | `src/lib/role-context.tsx`, `src/app/dashboard/layout.tsx` | `defaultRole` prop desde session.user.role |
| RoleProvider duplicado en root layout | `src/app/layout.tsx` | Eliminado del root layout (solo en dashboard layout) |
| Register page usaba `setTimeout` simulado | `src/app/register/page.tsx` | Conectado a `POST /api/auth/register` real |

---

## Gaps conocidos (no bugs, funcionalidad incompleta)

1. **Dictamen assessor no persiste en BD** — `handleSave` en `/dashboard/review/[id]/page.tsx` simula con setTimeout. Falta `POST /api/documents/[id]/certifications`.
2. **Tipos de certificación en registro** — El selector del paso 2 en `/register` es solo visual, el campo `certTypes` no se envía al API ni se guarda en BD.
3. **Sin guards de rol en páginas** — Cualquier usuario autenticado puede acceder a `/dashboard/queue`, `/dashboard/review/[id]`, `/dashboard/companies`. Falta validación de rol.
4. **Notificaciones** — No hay sistema de notificaciones al cambiar estado de documentos o dictámenes.
5. **Certificado final** — No existe generación de PDF con QR verificable.
