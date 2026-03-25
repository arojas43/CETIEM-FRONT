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
│  │ • Descarga   │    │ • Q&A / Grafo│    │ • Kill-switch    │  │
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
│  │  PDF → SHA-256 → PageIndex → Cognee → FalkorDB          │  │
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
         │ (Assessor o Admin dispara procesamiento)
         │ POST /api/documents/[id]/process
         ▼
┌─────────────────┐
│  PROCESSING     │  BullMQ Worker en background
└────────┬────────┘
         │
         ├── PageIndex extrae estructura jerárquica
         │     → secciones, capítulos, páginas
         │     → guardadas en tabla PageIndex (BD)
         │
         ├── Cognee extrae entidades y relaciones
         │
         └── FalkorDB almacena grafo de conocimiento
                   → MATCH (n)-[r]->(m) ...
         │
         ▼
┌─────────────────┐
│  INDEXED        │  PageIndex completo
│  → ANALYZED     │  PageIndex + Cognee + FalkorDB OK
│  → FAILED       │  Error en algún paso
└────────┬────────┘
         │
         │ (Assessor entra a revisar)
         ▼
┌─────────────────────────────────┐
│  Dictamen del Assessor          │
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
  ✗ Reprocesar documentos (debe subir uno nuevo)
  ✗ Ver documentos de otras empresas
  ✗ Cambiar el dominio de análisis
  ✗ Acceder al grafo, Q&A o consola Cypher
  ✗ Ver el audit log global
  ✗ Asignar assessors
```

---

## 3. Flujo Assessor (ASSESSOR)

### 3.1 Cola de revisión

```
/dashboard/queue
│
├── Sección "Sin dictamen" (documentos ANALYZED o INDEXED sin cert)
│   • Botón "Iniciar Revisión" → /dashboard/review/[id]
│
└── Sección "Ya dictaminados" (tienen cert)
    • Badge con cert status (APPROVED / IN_REVIEW / etc.)
    • Botón "Re-revisar" → /dashboard/review/[id]
```

### 3.2 Consola Split-View (Motor V.L.A.P.)

```
/dashboard/review/[id]
│
├── IZQUIERDA: Visor PDF embebido
│   • PDF del documento de la empresa
│
└── DERECHA: Formulario de dictamen
    │
    ├── Panel V.L.A.P.
    │   ┌─────────────────────────────────────────┐
    │   │  Vigencia     [✓][✗]  Confianza: [===] 92% │
    │   │  Legibilidad  [✓][✗]  Confianza: [===] 78% ⚠ HARD STOP
    │   │  Autoría      [✓][✗]  Confianza: [===] 88% │
    │   │  Pertinencia  [✓][✗]  Confianza: [===] 95% │
    │   │                                             │
    │   │  Score VLAP: 88%    [Override si justificado]│
    │   └─────────────────────────────────────────┘
    │   Hard Stop si algún criterio < 85% sin override
    │
    ├── Hallazgos
    │   • Tipo: COMPLIANCE / NON_COMPLIANCE / OBSERVATION / RECOMMENDATION
    │   • Severidad: LOW / MEDIUM / HIGH / CRITICAL
    │   • Página de referencia (opcional)
    │   • Nota: NON_COMPLIANCE → genera CAPA 30 días automáticamente
    │
    ├── Notas generales (visibles a la empresa)
    │
    └── Veredicto
        ┌─────────────────────────────────────────────┐
        │  [APROBAR]  [SOLICITAR CAMBIOS]  [RECHAZAR]  │
        └─────────────────────────────────────────────┘
              │              │                  │
              ▼              ▼                  ▼
         APPROVED       IN_REVIEW /         REJECTED
        + Cert ESG      CAPA_OPEN
        + UUID          (si NC findings)
        + SHA-256
```

### 3.3 Herramientas del Assessor por documento

```
/dashboard/documents/[id]  (vista assessor)
│
├── [Procesar]      → /api/documents/[id]/process
│     • Selecciona dominio: Industria / Construcción / Tecnología
│     • Modos: Auto / Mixto / Dirigido
│
├── [Preguntar]     → /dashboard/documents/[id]/qa
│     • Q&A con GLM4.7 sobre el contenido del documento
│     • Búsqueda paralela: FalkorDB + PageIndex + keyword
│
├── [Ver Contenido] → /dashboard/documents/[id]/content
│     • Texto estructurado extraído por PageIndex
│     • Secciones con jerarquía de niveles
│
└── [Ver Grafo]     → /dashboard/documents/[id]/graph
      • Grafo de entidades y relaciones (Cognee + FalkorDB)
      • Visualización interactiva
```

---

## 4. Flujo Administrador (ADMIN)

### 4.1 Gestión de empresas

```
/dashboard/companies
│
├── Stats globales: total, Track A/B/C, sin assessor
│
├── Por empresa:
│   • Track badge (A/B/C)
│   • Sprint Level (Startup/Pequeña/Mediana)
│   • Assessor asignado (o "Sin assessor" en rojo)
│   • Dropdown para asignar/cambiar assessor
│     → PATCH /api/companies/[id]/assign
│     → AuditLog: ASSESSOR_ASSIGNED
│
└── Documentos por empresa:
    • Estado IA + Cert status badge (APPROVED/CAPA_OPEN/etc.)
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
         │ POST /api/documents/[id]/process
         │ (disparado por Assessor/Admin)
         ▼
┌──────────────────────────────────────────────────────┐
│  2. EXTRACCIÓN DE TEXTO                              │
│     • pdf-parse → extrae texto por página            │
│     • Si falla → Tesseract.js (OCR)                 │
│     • status = PROCESSING                           │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  3. PageIndex — Indexación Jerárquica                │
│     • Detecta capítulos, secciones, subsecciones    │
│     • Asigna nivel (1, 2, 3...) y página            │
│     • Guarda en tabla PageIndex (BD)                │
│     • Permite navegación estructurada               │
│     • status = INDEXED                              │
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  4. Cognee — Extracción de Grafo                     │
│     • Identifica entidades: ORG, PERSON, NORM...    │
│     • Identifica relaciones entre entidades         │
│     • Modo Auto / Mixto / Dirigido                  │
│     • Dominio: Industria / Construcción / Tecnología│
└──────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────┐
│  5. FalkorDB — Grafo de Conocimiento                 │
│     • Nodos: entidades extraídas por Cognee         │
│     • Aristas: relaciones entre entidades           │
│     • Aislado por documentId                        │
│     • Consultas Cypher disponibles                  │
│     • status = ANALYZED                             │
└──────────────────────────────────────────────────────┘
         │
         ▼
Assessor puede usar:
  • Q&A: búsqueda paralela FalkorDB + PageIndex + keyword → GLM4.7
  • Grafo: visualización de entidades y relaciones
  • Contenido: texto estructurado con jerarquía
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
  INDEXED    = PageIndex completado
  ANALYZED   = Todo el pipeline completado
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
  /                    Landing page
  /auth/signin         Login
  /register            Registro de empresa

Empresa (COMPANY):
  /dashboard           Dashboard con progreso y KPIs
  /dashboard/documents Lista de mis documentos
  /dashboard/documents/[id]  Detalle del documento + dictamen
  /dashboard/upload    Subir nuevo documento
  /dashboard/capa      Mis tickets CAPA

Assessor (ASSESSOR):
  /dashboard           Dashboard con cola y estadísticas
  /dashboard/queue     Cola de revisión
  /dashboard/review/[id]  Consola Split-View + V.L.A.P.
  /dashboard/documents    Todos los documentos
  /dashboard/documents/[id]  Detalle + procesamiento + Q&A + grafo
  /dashboard/companies    Empresas asignadas
  /dashboard/capa         Todos los tickets CAPA
  /dashboard/graph        Grafo global (Cypher)

Admin (ADMIN):
  [Todo lo de Assessor, más:]
  /dashboard/assessors    Lista de assessors
  /dashboard/logs         Audit Log global
  [Kill-switch en detalle de documento si cert=APPROVED]
  [Asignación assessor en /dashboard/companies]
  [Exportar CSV desde /dashboard/logs o /api/export/documents]
```
