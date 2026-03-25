# CETIEM — Plataforma de Certificación Empresarial ESG con IA

Sistema de auditoría y certificación ESG asistido por inteligencia artificial. Las empresas suben documentos, el sistema los procesa con IA (PageIndex + Cognee + FalkorDB), y los Data Assessors emiten dictámenes formales con el motor V.L.A.P.

---

## Inicio rápido para desarrolladores

### 1. Clonar y preparar el entorno

```bash
git clone git@github.com:Cipre-Holding/RAG1.git
cd RAG1
npm install
cp .env.example .env
```

### 2. Completar `.env`

Abre `.env` y rellena:

| Variable | Dónde obtenerla |
|----------|----------------|
| `NEXTAUTH_SECRET` / `AUTH_SECRET` | `openssl rand -base64 32` (genera una clave) |
| `NVIDIA_API_KEY` | [build.nvidia.com](https://build.nvidia.com) → API Key (plan gratuito disponible) |
| `NVIDIA_QA_API_KEY` | Puede ser la misma que `NVIDIA_API_KEY` |
| El resto | Ya tienen valores por defecto para Docker Compose |

### 3. Levantar servicios de infraestructura

```bash
docker compose up -d
```

Esto levanta:
- **PostgreSQL** → `localhost:5432` (user: `postgres`, pass: `cetiem`, db: `cetiem_db`)
- **Redis** → `localhost:6379` (BullMQ)
- **FalkorDB** → `localhost:6380` + UI en `localhost:3001`

### 4. Inicializar la base de datos

```bash
npm run db:push     # Aplica el schema de Prisma a PostgreSQL
npx prisma db seed  # Crea los 4 usuarios de prueba
```

### 5. Arrancar la aplicación

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Workers BullMQ (procesamiento de documentos en background)
npm run workers
```

La app queda disponible en **http://localhost:3000**

---

## Usuarios de prueba

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@cetiem.mx` | `cetiem2024` | Super Admin |
| `assessor@cetiem.mx` | `cetiem2024` | Data Assessor |
| `empresa1@cetiem.mx` | `cetiem2024` | Empresa (Track A — Industria) |
| `empresa2@cetiem.mx` | `cetiem2024` | Empresa (Track B — Construcción) |

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5.6 |
| Base de datos | PostgreSQL 16 + Prisma 6 |
| Autenticación | NextAuth v5 (JWT, CredentialsProvider, bcryptjs) |
| LLM / IA | NVIDIA NIM — GLM4.7 / Llama 3.1 70B |
| Grafo de conocimiento | FalkorDB + Cognee |
| Indexación semántica | PageIndex (jerarquía de PDFs) |
| Cola de tareas | BullMQ + Redis 7 |
| Almacenamiento | Local (`./uploads/`) en dev · Google Cloud Storage en prod |
| OCR (fallback) | Tesseract.js |
| UI | Tailwind CSS (tokens CETIEM dark theme) · Lucide Icons |

---

## Sectores certificables

| Track | Dominio IA | Descripción |
|-------|-----------|-------------|
| Track A | `INDUSTRIA` | Manufactura, logística, procesos industriales |
| Track B | `CONSTRUCCION` | Obra civil, arquitectura, contratistas |
| Track C | `TECNOLOGIA` | Software, consultoría, servicios digitales |

---

## Comandos útiles

```bash
# Desarrollo
npm run dev              # Next.js en http://localhost:3000
npm run workers          # Workers BullMQ (terminal separada)

# Base de datos
npm run db:push          # Aplica schema sin generar migración (dev)
npm run db:generate      # Regenera el cliente Prisma tras cambios en schema
npm run db:studio        # Abre Prisma Studio (GUI de la BD) en localhost:5555
npm run db:migrate       # Genera y aplica migración formal (producción)
npx prisma db seed       # Restaura los 4 usuarios de prueba

# Docker
docker compose up -d     # Levantar PostgreSQL + Redis + FalkorDB
docker compose down      # Detener servicios
docker compose down -v   # Detener y borrar volúmenes (reset completo)

# Producción
npm run build            # Build de producción
npm run start            # Servidor de producción
```

---

## Estructura del proyecto

```
.
├── .env.example              ← Plantilla de variables de entorno
├── docker-compose.yml        ← PostgreSQL + Redis + FalkorDB
├── prisma/
│   ├── schema.prisma         ← Modelos y enums
│   └── seed.ts               ← Usuarios de prueba
├── src/
│   ├── app/
│   │   ├── page.tsx          ← Landing page
│   │   ├── auth/signin/      ← Login
│   │   ├── register/         ← Registro empresa (multi-paso)
│   │   ├── dashboard/        ← Todas las páginas autenticadas
│   │   │   ├── page.tsx      ← Dashboard dinámico por rol
│   │   │   ├── dashboard-view.tsx  ← 3 vistas (Empresa / Assessor / Admin)
│   │   │   ├── upload/       ← Subida de documentos
│   │   │   ├── documents/    ← Lista y detalle de documentos
│   │   │   ├── review/[id]/  ← Split-View con motor V.L.A.P.
│   │   │   ├── queue/        ← Cola de revisión (Assessor)
│   │   │   ├── companies/    ← Gestión empresas + asignación assessor
│   │   │   ├── assessors/    ← Lista de assessors
│   │   │   ├── capa/         ← Tickets CAPA (todos los roles)
│   │   │   ├── logs/         ← Audit Log (Admin)
│   │   │   └── graph/        ← Grafo global Cypher (Admin/Assessor)
│   │   └── api/
│   │       ├── auth/         ← NextAuth + registro
│   │       ├── documents/    ← CRUD + procesamiento + certifications
│   │       ├── capa/         ← Tickets CAPA
│   │       ├── audit/        ← Audit log (Admin)
│   │       ├── export/       ← CSV export
│   │       ├── companies/    ← Asignación assessor
│   │       └── graph/        ← Cypher queries + stats
│   ├── components/
│   │   ├── sidebar.tsx       ← Navegación por rol
│   │   └── document-list-paginated.tsx
│   └── lib/
│       ├── auth.ts           ← Config NextAuth
│       ├── audit.ts          ← logAudit() append-only
│       ├── db.ts             ← Prisma client singleton
│       ├── role-context.tsx  ← RoleContext + RoleProvider
│       ├── falkordb.ts       ← Cliente FalkorDB
│       ├── cognee-service.ts ← Extracción de grafo
│       ├── pageindex-real.ts ← Indexación jerárquica PDF
│       ├── process-document-service.ts ← Orquestador IA
│       └── queue/            ← BullMQ workers
└── GUIA.md                   ← Guía completa con diagramas de flujo
```

---

## Flujo completo del sistema

```
1. Empresa se registra  (/register)  →  Elige Track A/B/C
2. Empresa inicia sesión (/auth/signin)
3. Empresa sube un PDF  (/dashboard/upload)
      → SHA-256 calculado, guardado en /uploads/
      → AuditLog: DOCUMENT_UPLOADED
4. Assessor procesa el documento (/dashboard/queue)
      → BullMQ Worker:
          a. Extracción de texto  (pdf-parse / Tesseract OCR)
          b. PageIndex            → secciones en BD
          c. Cognee               → entidades y relaciones
          d. FalkorDB             → grafo de conocimiento
          e. Estado: ANALYZED
5. Assessor revisa en Split-View (/dashboard/review/[id])
      → Motor V.L.A.P. (4 criterios, Hard Stop < 85%)
      → Hallazgos con tipo y severidad
      → Veredicto: APPROVED / CHANGES_REQUESTED / REJECTED
      → Si NON_COMPLIANCE → CAPA tickets (30 días) automáticos
6. Empresa ve el dictamen (/dashboard/documents/[id])
      → Si APPROVED → descarga Certificado ESG (HTML + SHA-256)
      → Si CAPA_OPEN → gestiona tickets en /dashboard/capa
7. Admin puede revocar un certificado (Kill-switch)
      → AuditLog: CERT_REVOKED
```

---

## Roles y permisos

| Acción | Empresa | Assessor | Admin |
|--------|---------|----------|-------|
| Subir documentos | Si | Si | Si |
| Reprocesar documentos | No | Si | Si |
| Ver sus propios documentos | Si | Si | Si |
| Ver documentos de otras empresas | No | Si | Si |
| Usar Q&A / Grafo de conocimiento | No | Si | Si |
| Emitir dictamen V.L.A.P. | No | Si | Si |
| Ver Audit Log | No | No | Si |
| Exportar CSV | No | Si | Si |
| Asignar assessors a empresas | No | No | Si |
| Revocar certificados (Kill-switch) | No | No | Si |
| Ver Tickets CAPA | Solo propios | Todos | Todos |

---

## Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|---------|
| Error `esgScore` no reconocido | Prisma Client no regenerado | `npm run db:generate` + reiniciar servidor |
| `PrismaClientValidationError` en campo nuevo | Schema no aplicado a la BD | `npm run db:push` |
| FalkorDB rechaza escrituras (MISCONF) | Config Redis en FalkorDB | `docker exec cetiem-falkordb redis-cli CONFIG SET stop-writes-on-bgsave-error no` |
| Q&A responde en chino | GLM4.7 sin instrucción de idioma | Verificar system prompt en `lib/qwen-qa.ts` |
| Workers no procesan documentos | Redis no disponible | `docker compose up -d redis` |
| Puerto 3000 ocupado | Proceso previo | `lsof -ti:3000 \| xargs kill -9` |
| Login falla con usuarios de prueba | Seed no ejecutado | `npx prisma db seed` |

---

## Variables de entorno — referencia completa

Ver `.env.example` para la lista completa con comentarios explicativos.

Las únicas variables que **debes configurar manualmente** son:
- `NEXTAUTH_SECRET` y `AUTH_SECRET` → genera con `openssl rand -base64 32`
- `NVIDIA_API_KEY` y `NVIDIA_QA_API_KEY` → crea cuenta en [build.nvidia.com](https://build.nvidia.com)

El resto tiene valores por defecto que funcionan con `docker compose up -d`.
