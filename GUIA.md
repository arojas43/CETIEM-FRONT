# CETIEM — Guía del Sistema

Guía completa de funcionamiento de la plataforma de certificación ESG con IA.

---

## Índice

1. [Visión General](#1-visión-general)
2. [Flujo Empresa (COMPANY)](#2-flujo-empresa-company)
3. [Flujo Assessor (ASSESSOR)](#3-flujo-assessor-assessor)
4. [Flujo Administrador (ADMIN)](#4-flujo-administrador-admin)
5. [Pipeline de IA](#5-pipeline-de-ia)
6. [Motor V.L.A.P.](#6-motor-vlap)
7. [Sistema de Tickets CAPA](#7-sistema-de-tickets-capa)
8. [Certificado ESG](#8-certificado-esg)
9. [Audit Log](#9-audit-log)
10. [Estados y Transiciones](#10-estados-y-transiciones)

---

## 1. Visión General

```
┌─────────────────────────────────────────────────────────────────┐
│                     PLATAFORMA CETIEM                           │
│                                                                 │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   EMPRESA    │    │   ASSESSOR   │    │      ADMIN       │  │
│  │              │    │              │    │                  │  │
│  │ • Sube docs  │    │ • Revisa     │    │ • Gestiona todo  │  │
│  │ • Ve estado  │    │   expedientes│    │ • Asigna         │  │
│  │ • Ve CAPA    │    │ • V.L.A.P.   │    │   assessors      │  │
│  │ • Descarga   │    │ • Q&A con IA │    │ • Kill-switch    │  │
│  │   certificado│    │ • Emite      │    │ • Logs / CSV     │  │
│  └──────┬───────┘    │   dictamen   │    └──────────────────┘  │
│         │            └──────┬───────┘                          │
│         │                   │                                  │
│    Sube PDF            Revisa + Dictamina                       │
│         │                   │                                  │
│         ▼                   ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  PIPELINE IA                             │  │
│  │                                                          │  │
│  │  PDF → PageIndex → OpenKB → Kimi K2.6 → AiDictamen      │  │
│  │                                                          │  │
│  │  PENDING → PROCESSING → INDEXED → ANALYZED → (FAILED)   │  │
│  └──────────────────────────────────────────────────────────┘  │
│         │                   │                                  │
│         ▼                   ▼                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │               CERTIFICACIÓN ESG                          │  │
│  │                                                          │  │
│  │  APPROVED → Certificado HTML + SHA-256 + UUID            │  │
│  │  CAPA_OPEN → Tickets 30 días por No Conformidades        │  │
│  │  REJECTED  → Empresa debe mejorar y resubir              │  │
│  │  REVOKED   → Kill-switch Admin (audit log)               │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. Flujo Empresa (COMPANY)

### 2.1 Registro

```
/register (multi-paso)
│
├── Paso 1: Datos de empresa
│   • Nombre completo
│   • Nombre de empresa
│   • Email (único en el sistema)
│   • Contraseña (bcrypt)
│
├── Paso 2: Track Sectorial
│   • Track A — Industria
│   • Track B — Construcción
│   • Track C — Tecnología / Servicios
│
└── Paso 3: Confirmación → redirige a /auth/signin
```

### 2.2 Ciclo de vida de un documento

```
Empresa sube PDF
       │
       ▼
┌─────────────────┐
│  /dashboard/    │  drag-and-drop, máx 50 MB
│  upload         │  Solo PDFs
└────────┬────────┘
         │ POST /api/documents
         │ • SHA-256 calculado del archivo
         │ • AuditLog: DOCUMENT_UPLOADED
         ▼
┌─────────────────┐
│  Estado: PENDING│  Documento guardado en /uploads/
└────────┬────────┘  o Google Cloud Storage (prod)
         │
         │ BullMQ worker (automático al subir)
         ▼
┌─────────────────┐
│  PROCESSING     │  Pipeline IA en background
└────────┬────────┘
         │
         ├── PageIndex extrae estructura jerárquica
         │     → capítulos, secciones, subsecciones
         │     → guardadas en tabla PageIndex (BD)
         │     → status = INDEXED
         │
         ├── OpenKB indexa el documento en el KB de la empresa
         │     → wiki por empresa (cross-documento)
         │     → status = ANALYZED
         │
         └── Kimi K2.6 genera Dictamen IA (automático)
               → VLAP + hallazgos + resumen ejecutivo
               → guardado en tabla AiDictamen
         │
         ▼
┌─────────────────────────────────┐
│  Dictamen del Assessor          │
│  (basado en el Dictamen IA)     │
│                                 │
│  APPROVED   → Cert ESG emitido  │
│  IN_REVIEW  → Cambios solicitados│
│  REJECTED   → Rechazado         │
│  CAPA_OPEN  → NC findings       │
└─────────────────────────────────┘
         │
         ▼
Empresa ve el resultado en:
• /dashboard/documents/[id]  → sección "Dictamen del Assessor"
• /dashboard               → paso 3 y 4 del progreso
• /dashboard/capa          → tickets CAPA si aplica
```

### 2.3 Lo que la empresa puede y NO puede hacer

```
PUEDE:
  ✓ Subir nuevos documentos PDF
  ✓ Ver el estado de sus documentos
  ✓ Ver el dictamen y hallazgos del assessor
  ✓ Descargar el Certificado ESG (si APPROVED)
  ✓ Gestionar sus Tickets CAPA
  ✓ Ver el progreso de certificación en 4 pasos

NO PUEDE:
  ✗ Reprocesar documentos (solo Assessor o Admin)
  ✗ Ver documentos de otras empresas
  ✗ Usar Q&A con IA sobre los documentos
  ✗ Ver el Dictamen IA preliminar
  ✗ Ver el audit log global
  ✗ Asignar assessors
```

---

## 3. Flujo Assessor (ASSESSOR)

> **Aislamiento de datos:** Un assessor solo puede ver, procesar y dictaminar
> documentos y empresas que le han sido asignadas por el Admin. Intentar acceder
> a recursos de otras empresas devuelve 403 a nivel de API.

### 3.1 Cola de revisión

```
/dashboard/queue  (solo documentos de empresas asignadas al assessor)
│
├── Sección "Sin dictamen" (documentos ANALYZED o INDEXED sin cert)
│   • Botón "Iniciar Revisión" → /dashboard/review/company/[companyId]
│
└── Sección "Ya dictaminados" (tienen cert)
    • Badge con cert status (APPROVED / IN_REVIEW / etc.)
    • Botón "Re-revisar" → /dashboard/review/company/[companyId]
```

### 3.2 Consola de revisión de empresa (Motor V.L.A.P.)

```
/dashboard/review/company/[companyId]
│
├── Lista de documentos del expediente (acordeón expandible)
│   • Visor PDF inline por documento
│   • Índice de secciones (PageIndex)
│   • Dictamen IA preliminar (VLAP + hallazgos de Kimi K2.6)
│   • Enlace a detalle → /dashboard/documents/[id]?from=review
│
└── Formulario de dictamen (empresa completa)
    │
    ├── Panel V.L.A.P.
    │   ┌─────────────────────────────────────────────┐
    │   │  Vigencia     [✓][✗]  Confianza: [===] 92%   │
    │   │  Legibilidad  [✓][✗]  Confianza: [===] 78% ⚠  │  ← Hard Stop activo
    │   │  Autoría      [✓][✗]  Confianza: [===] 88%   │
    │   │  Pertinencia  [✓][✗]  Confianza: [===] 95%   │
    │   │                                               │
    │   │  Score ESG: 88%    [Override si justificado]  │
    │   └─────────────────────────────────────────────┘
    │   • Hard Stop: botón "Guardar" DESHABILITADO si cualquier criterio
    │     < 85% y no tiene override marcado
    │
    ├── Hallazgos
    │   • Tipo: COMPLIANCE / NON_COMPLIANCE / OBSERVATION / RECOMMENDATION
    │   • Severidad: LOW / MEDIUM / HIGH / CRITICAL
    │   • Página de referencia (opcional)
    │   • NON_COMPLIANCE → genera ticket CAPA automáticamente (30 días)
    │
    ├── Notas generales (visibles a la empresa)
    │
    └── Veredicto
        ┌──────────────────────────────────────────────┐
        │  [APROBAR]  [SOLICITAR CAMBIOS]  [RECHAZAR]  │
        └──────────────────────────────────────────────┘
              │              │                  │
              ▼              ▼                  ▼
         APPROVED        IN_REVIEW /         REJECTED
        + Cert ESG       CAPA_OPEN
        + UUID           (si NC findings)
        + SHA-256
```

### 3.3 Herramientas del Assessor por documento

```
/dashboard/documents/[id]  (vista assessor — solo empresa asignada)
│
├── Visor PDF inline    → toggle [Ver PDF / Ocultar PDF]
│
├── [Procesar]          → POST /api/documents/[id]/process
│     • Selecciona dominio: Industria / Construcción / Tecnología
│     • Ejecuta runFullPipeline() directamente (sin cola BullMQ)
│     • Útil cuando Redis está caído o para forzar reprocesamiento
│
├── [Preguntar]         → POST /api/documents/[id]/search (Q&A con IA)
│     • Capa 1: OpenKB (wiki de la empresa, razonamiento cross-documento)
│     • Capa 2: Si OpenKB falla → PageIndex + Llama 3.1 70B directo
│     • La respuesta indica qué motor respondió (openkb / pageindex)
│
├── [Ver Contenido]     → /dashboard/documents/[id]/content
│     • Árbol PageIndex completo (capítulos, secciones, subsecciones)
│     • Texto estructurado con jerarquía de niveles y páginas
│
└── [Dictamen IA]       → /dashboard/review/company/{document.userId}
      • Enlace a la consola de revisión completa de la empresa
      • Muestra VLAP preliminar + hallazgos generados por Kimi K2.6
      • El assessor valida, ajusta y emite su dictamen final
```

---

## 4. Flujo Administrador (ADMIN)

> **Acceso total:** El Admin ve todos los recursos del sistema sin restricción.
> Solo el Admin puede asignar assessors, revocar certificados y ver el Audit Log.

### 4.1 Gestión de empresas

```
/dashboard/companies
│
├── Stats globales: total empresas, Track A/B/C, sin assessor asignado
│
├── Por empresa:
│   • Track badge (A/B/C)
│   • Sprint Level (Startup/Pequeña/Mediana)
│   • Assessor asignado (o "Sin assessor" en rojo)
│   • Dropdown para asignar/cambiar assessor
│     → PATCH /api/companies/[id]/assign
│     → AuditLog: ASSESSOR_ASSIGNED
│   • Botón "Revisar" → /dashboard/review/company/[id]
│
└── Documentos por empresa:
    • Estado IA + Cert status badge (APPROVED/CAPA_OPEN/etc.)
    • Dictamen IA disponible si ya se generó
```

### 4.2 Kill-switch (revocación de certificado)

```
/dashboard/documents/[id]  (vista admin, cert APPROVED)
│
└── [Revocar]  (botón KillSwitchButton)
      │
      ├── Prompt: "Ingresa la razón de la revocación"
      ├── Confirm: "¿Confirmas revocar? Esta acción no se puede deshacer."
      │
      └── DELETE /api/documents/[id]/certifications
            • Body: { reason }
            • Actualiza cert: status = REVOKED
            • Guarda: revokedAt, revokedBy, revokeReason
            • AuditLog: CERT_REVOKED
```

### 4.3 Audit Log

```
/dashboard/logs
│
├── Lista paginada (20 por página)
│   • Color por acción:
│     DOCUMENT_UPLOADED  → teal
│     CERT_ISSUED        → lime
│     CERT_REVOKED       → rojo
│     ASSESSOR_ASSIGNED  → amber
│     CAPA_UPDATED       → gris
│
└── [Exportar CSV] → GET /api/export/documents
      • Columnas: ID, Nombre, Empresa, Email, Track, Estado IA,
                  SHA-256, Veredicto, Score ESG, Fecha subida, Fecha dictamen
```

---

## 5. Pipeline de IA

```
PDF subido por empresa
         │
         │ POST /api/documents  
         ▼
┌──────────────────────────────────────────────────────┐
│  1. RECEPCIÓN                                        │
│     • Validar tipo (PDF) y tamaño (< 50MB)          │
│     • Guardar en /uploads/{documentId}/{name}.pdf   │
│     • Calcular SHA-256 del archivo                  │
│     • Crear registro en BD con status=PENDING       │
│     • AuditLog: DOCUMENT_UPLOADED                   │
└──────────────────────────────────────────────────────┘
         │
         │ BullMQ Worker (automático)
         ▼
┌──────────────────────────────────────────────────────┐
│  2. PageIndex — Indexación Jerárquica                │
│     • pdfjs extrae texto página por página           │
│     • LLM (Llama 3.1 70B) detecta estructura:       │
│       capítulos, secciones, subsecciones             │
│     • Guarda árbol en tabla PageIndex (BD)           │
│     • Para docs > 50MB usa pdftotext (poppler)      │
│     • status = INDEXED                              │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  3. OpenKB — Base de Conocimiento                    │
│     • Toma los nodos de PageIndex                   │
│     • Envia al microservicio openkb-api:8001         │
│     • OpenKB construye/actualiza el wiki de empresa  │
│       → wiki/summaries/ (resumen por documento)     │
│       → wiki/concepts/  (conceptos cross-documento) │
│       → wiki/sources/   (contenido indexado)        │
│     • Un KB por empresa (companyId)                 │
│     • Hash SHA-256: evita reindexar si no cambió    │
│     • status = ANALYZED                             │
│     • (no bloquea: si OpenKB cae, sigue adelante)   │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  4. Kimi K2.6 — Dictamen IA (AiDictamen)             │
│     • Lee TODOS los nodos PageIndex de la empresa   │
│     • Los ensambla con separadores visuales:        │
│       ═══════════════════════════                   │
│       DOCUMENTO 1 DE 4 / Nombre: / Tipo: ...        │
│       ═══════════════════════════                   │
│     • Una sola llamada a Kimi K2.6 (1M tokens)      │
│     • Genera:                                       │
│       → VLAP: Vigencia / Legibilidad / Autoría /    │
│               Pertinencia (valor + confianza)       │
│       → Hallazgos con tipo y severidad              │
│       → Resumen ejecutivo                           │
│     • Guardado en tabla AiDictamen (status: READY)  │
└──────────────────────────────────────────────────────┘
         │
         ▼
Assessor puede usar:
  • Dictamen IA como punto de partida para su revisión
  • Q&A: pregunta → OpenKB (wiki empresa) o PageIndex + NIM directo
  • Contenido: texto estructurado con jerarquía PageIndex
```

---

## 6. Motor V.L.A.P.

```
V — Vigencia      ¿El documento está vigente y actualizado?
L — Legibilidad   ¿Es legible, estructurado y comprensible?
A — Autoría       ¿Tiene autor identificable, firma o sello?
P — Pertinencia   ¿Es relevante al sector y proceso declarado?

Para cada criterio:
  • Valor:      [✓ Pasa]  [✗ No pasa]
  • Confianza:  0% ──────────────── 100%
  • Override:   Assessor puede forzar paso con justificación

Reglas:
  • Confianza < 85% → HARD STOP (bloquea emisión)
  • Hard Stop superable con Override explícito
  • ESG Score = (criterios con valor=true / 4) × 100

Ejemplo:
  Vigencia     ✓ 92%  → pasa
  Legibilidad  ✓ 88%  → pasa
  Autoría      ✗ 70%  → NO pasa (Hard Stop, pero override posible)
  Pertinencia  ✓ 95%  → pasa

  → 3 criterios pasados → ESG Score = 75%
  → Si Override en Autoría → puede emitir dictamen

El Dictamen IA (Kimi K2.6) genera un VLAP preliminar que el assessor
puede usar como punto de partida, validando o ajustando cada criterio.
```

---

## 7. Sistema de Tickets CAPA

```
CAPA = Corrective And Preventive Action

Creación automática:
  POST /api/documents/[id]/certifications
  │
  └── Si findings contienen NON_COMPLIANCE:
        → Crear CapaTicket por cada finding NC
        → dueDate = hoy + 30 días
        → status = OPEN
        → AuditLog: CAPA_CREATED

Estados del ticket:
  OPEN ──────► IN_PROGRESS ──────► CLOSED
                    │
                    └─► OVERDUE (si dueDate < hoy)

Visibilidad:
  • Empresa  → solo sus propios tickets
  • Assessor → todos los tickets
  • Admin    → todos los tickets

Acciones:
  • [Marcar En Proceso] → PATCH /api/capa/[id] { status: "IN_PROGRESS" }
  • [Cerrar CAPA]       → PATCH /api/capa/[id] { status: "CLOSED", resolution: "..." }
                          → closedAt = now()
                          → AuditLog: CAPA_UPDATED
```

---

## 8. Certificado ESG

```
Generación (solo status=APPROVED):
  GET /api/documents/[id]/certificate
  │
  ├── Verifica cert.status === "APPROVED"
  ├── Obtiene: empresa, RFC, email, track, assessor
  ├── Obtiene: ESG Score, fecha, hallazgos V.L.A.P.
  └── Devuelve HTML con:
        • Logo y marca CETIEM
        • Datos formales de la empresa
        • Track Sectorial (A/B/C)
        • Score ESG (%)
        • Tabla V.L.A.P. detallada
        • Hash SHA-256 (sello forense)
        • ID de verificación (publicToken UUID)
        • Firma: "CETIEM S.C. — Innovación · Tecnología · Emprendimiento"
        • window.print() automático al cargar

Campos del certificado en BD (Certification):
  • status:        APPROVED / IN_REVIEW / REJECTED / REVOKED / CAPA_OPEN
  • esgScore:      Float (0-100)
  • sha256Hash:    Hash del contenido del dictamen
  • publicToken:   UUID único para verificación
  • revokedAt:     DateTime (si fue revocado)
  • revokedBy:     userId del admin que revocó
  • revokeReason:  Texto de la razón
```

---

## 9. Audit Log

Cada acción crítica genera un registro inmutable en la tabla `AuditLog`:

```
Acción              Cuándo                           Quién
──────────────────  ───────────────────────────────  ──────────
DOCUMENT_UPLOADED   Empresa sube PDF                 Empresa
CERT_ISSUED         Assessor emite dictamen          Assessor
CERT_REVOKED        Admin revoca certificado         Admin
ASSESSOR_ASSIGNED   Admin asigna empresa→assessor   Admin
CAPA_UPDATED        Empresa/Assessor cierra CAPA     Usuario

Campos:
  • userId:     quien realizó la acción
  • action:     string del evento
  • entityType: "Document" | "Certification" | "User" | "CapaTicket"
  • entityId:   ID del registro afectado
  • payload:    JSON con detalles adicionales
  • ipAddress:  IP del cliente (si disponible)
  • userAgent:  navegador (si disponible)

Acceso:
  GET /api/audit?page=1&limit=20  (Admin only)
  → Paginado, con datos del usuario (nombre, email)
```

---

## 10. Estados y Transiciones

### Documento

```
PENDING ──────► PROCESSING ──────► INDEXED ──────► ANALYZED
                     │                                  │
                     └──────────────────────────► FAILED

  PENDING    = Subido, sin procesar
  PROCESSING = Pipeline IA en ejecución (BullMQ)
  INDEXED    = PageIndex completado (árbol jerárquico en BD)
  ANALYZED   = PageIndex + OpenKB + AiDictamen completados
  FAILED     = Error en algún paso del pipeline
```

### Certificación

```
                ┌──────────────┐
                │   (sin cert) │
                └──────┬───────┘
                       │ Assessor emite dictamen
          ┌────────────┼──────────────┐
          ▼            ▼              ▼
      APPROVED      IN_REVIEW      REJECTED
          │         CAPA_OPEN
          │
          └──────► REVOKED  (Admin kill-switch)

  APPROVED   = Certificado ESG emitido, descargable
  IN_REVIEW  = Cambios solicitados (sin NC findings)
  CAPA_OPEN  = Con No Conformidades → tickets 30 días
  REJECTED   = Rechazado definitivamente
  REVOKED    = Revocado por Admin con razón documentada
```

### Ticket CAPA

```
OPEN ──────► IN_PROGRESS ──────► CLOSED
  │                │
  └───────────────►└──────────► OVERDUE (dueDate superado)

  OPEN        = Creado, pendiente de atención
  IN_PROGRESS = Empresa trabajando en la corrección
  CLOSED      = Cerrado con resolución documentada
  OVERDUE     = Venció el plazo de 30 días sin cerrarse
```

---

## Apéndice: Rutas de la aplicación

```
Públicas:
  /                            Landing page
  /auth/signin                 Login
  /register                    Registro de empresa (multi-paso)

──────────────────────────────────────────────────────────────
Empresa (COMPANY):
──────────────────────────────────────────────────────────────
  /dashboard                   Dashboard con progreso y KPIs propios
  /dashboard/upload            Subir nuevos PDFs (solo COMPANY)
  /dashboard/documents         Lista de mis documentos con estados
  /dashboard/documents/[id]    Detalle del doc + dictamen del assessor
                               → card "Dictamen IA" (link a review)
                               → barra de progreso SSE mientras procesa
  /dashboard/capa              Mis tickets CAPA (acciones correctivas)
  /dashboard/mi-certificado    Certificado ESG vigente (si APPROVED)

──────────────────────────────────────────────────────────────
Assessor (ASSESSOR):  [solo recursos de empresas asignadas]
──────────────────────────────────────────────────────────────
  /dashboard                      Dashboard con stats de empresas asignadas
  /dashboard/queue                Cola de revisión (ANALYZED/INDEXED sin cert)
  /dashboard/review/company/[id]  Consola completa de dictamen + V.L.A.P.
  /dashboard/review/[docId]       Revisión de documento individual
  /dashboard/documents            Documentos de empresas asignadas
  /dashboard/documents/[id]       Detalle + [Procesar] + [Preguntar] + [Contenido]
  /dashboard/documents/[id]/content  Árbol PageIndex (texto estructurado)
  /dashboard/companies            Empresas asignadas con estado de certificación
  /dashboard/capa                 Tickets CAPA de empresas asignadas

──────────────────────────────────────────────────────────────
Admin (ADMIN):  [acceso total a todos los recursos]
──────────────────────────────────────────────────────────────
  [Todo lo de Assessor sobre TODAS las empresas, más:]
  /dashboard/assessors            Crear y gestionar assessors
  /dashboard/logs                 Audit Log global paginado + exportar CSV
  [Kill-switch]                   En detalle de documento si cert=APPROVED
  [Asignación assessor]           En /dashboard/companies → dropdown por empresa
```

---

## Apéndice: Control de acceso a nivel de API

El helper `src/lib/access.ts` centraliza la lógica de autorización:

```
canAccessDocument(documentUserId, session)
  ADMIN   → siempre permitido
  COMPANY → solo si documentUserId === session.user.id
  ASSESSOR → solo si document.owner.assessorId === session.user.id

canAccessCompany(companyId, session)
  ADMIN   → siempre permitido
  COMPANY → solo si companyId === session.user.id
  ASSESSOR → solo si company.assessorId === session.user.id
```

Todas las rutas bajo `/api/documents/[id]/*` y `/api/companies/[id]/*`
usan estas funciones. Un assessor que intenta acceder a recursos de una
empresa no asignada recibe `403 Forbidden`.
