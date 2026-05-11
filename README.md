# CETIEM — Plataforma de Certificación ESG con IA

Sistema de auditoría y certificación ESG asistido por inteligencia artificial. Las empresas suben documentos, el sistema los procesa con IA (PageIndex + OpenKB + Kimi K2.6), y los Assessors ESG emiten dictámenes formales con el motor V.L.A.P.

---

## Inicio rápido para desarrolladores

### 1. Clonar

```bash
git clone git@github.com:Cipre-Holding/RAG1.git
cd RAG1
```

### 2. Configurar API keys de NVIDIA

```bash
cp .env.example .env
```

Abre `.env` y rellena estas variables (el resto lo maneja Docker):

| Variable | Uso |
|----------|-----|
| `NVIDIA_API_KEY` | Pipeline principal (indexación + embeddings) |
| `NVIDIA_INTENT_API_KEY` | Dictamen IA con Kimi K2.6 (cuota separada) |
| `NVIDIA_QA_API_KEY` | Q&A (puede ser la misma que `NVIDIA_API_KEY`) |

Obtén las keys en [build.nvidia.com](https://build.nvidia.com) (plan gratuito disponible).

### 3. Levantar todo

```bash
docker compose up --build
```

Esto levanta **todos los servicios** automáticamente:
- Build de la aplicación Next.js
- Migración y seed de la base de datos (usuarios de prueba incluidos)
- Workers BullMQ para procesamiento de documentos con IA
- PostgreSQL, Redis, OpenKB API

| URL | Descripción |
|-----|-------------|
| `http://localhost:3000` | Aplicación principal |
| `http://localhost:8001/health` | OpenKB API — healthcheck |
| `localhost:5434` | PostgreSQL (Prisma Studio / cliente externo) |

> **Nota:** El primer `docker compose up --build` tarda ~3 minutos en compilar la imagen.
> Las siguientes veces usa `docker compose up` (sin `--build`) y arranca en segundos.

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
| LLM principal | Kimi K2.6 vía NVIDIA NIM (1M tokens — dictamen + Q&A) |
| LLM auxiliar | Llama 3.1 70B vía NVIDIA NIM (Q&A rápido, tree search) |
| Indexación semántica | PageIndex (árbol jerárquico de PDFs, pdfjs local) |
| Base de conocimiento | OpenKB — wiki por empresa, Q&A cross-documento |
| Cola de tareas | BullMQ + Redis 7 |
| Almacenamiento | Local (`./uploads/`) en dev · Google Cloud Storage en prod |
| UI | Tailwind CSS · SHADCN UI · dark theme CETIEM |

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
npm run db:studio        # Abre Prisma Studio en localhost:5555
npm run db:migrate       # Genera y aplica migración formal (producción)
npx prisma db seed       # Restaura los usuarios de prueba

# Docker
docker compose up -d     # Levantar todos los servicios
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
├── .env.example              ← Variables de entorno con comentarios
├── docker-compose.yml        ← PostgreSQL + Redis + OpenKB + App + Workers
├── ARCHITECTURE.md           ← Documentación técnica completa del sistema
├── GUIA.md                   ← Guía de uso por rol con diagramas de flujo
├── openkb-api/               ← Microservicio Python (FastAPI + OpenKB)
│   ├── main.py               ← Endpoints: /add, /search, /delete, /health
│   └── Dockerfile
├── prisma/
│   ├── schema.prisma         ← Modelos y enums
│   └── seed.ts               ← Usuarios de prueba
└── src/
    ├── app/
    │   ├── page.tsx          ← Landing page
    │   ├── auth/signin/      ← Login
    │   ├── register/         ← Registro empresa (multi-paso)
    │   └── dashboard/        ← Todas las páginas autenticadas
    │       ├── upload/       ← Subida de documentos
    │       ├── documents/    ← Lista y detalle de documentos
    │       ├── review/       ← Split-View con motor V.L.A.P.
    │       ├── queue/        ← Cola de revisión (Assessor)
    │       ├── companies/    ← Gestión empresas + asignación assessor
    │       ├── assessors/    ← Lista de assessors
    │       ├── capa/         ← Tickets CAPA (todos los roles)
    │       └── logs/         ← Audit Log (Admin)
    └── lib/
        ├── document-pipeline.ts      ← Pipeline: runIndexing + runAnalysis
        ├── ai-dictamen-service.ts    ← Dictamen IA con Kimi K2.6
        ├── openkb-client.ts          ← Cliente para OpenKB API
        ├── pageindex-real.ts         ← Indexación jerárquica PDF (pdfjs)
        ├── qa-service.ts             ← Q&A: PageIndex + NIM (fallback)
        ├── process-document-service.ts ← Proxy a runFullPipeline
        ├── auth.ts                   ← Config NextAuth
        ├── audit.ts                  ← logAudit() append-only
        ├── access.ts                 ← canAccessDocument / canAccessCompany
        ├── db.ts                     ← Prisma client singleton
        └── queue/                    ← BullMQ workers
```

---

## Flujo completo del sistema

```
1. Empresa se registra  (/register)  →  Elige Track A/B/C
2. Empresa inicia sesión (/auth/signin)
3. Empresa sube un PDF  (/dashboard/upload)
      → SHA-256 calculado, guardado en /uploads/
      → AuditLog: DOCUMENT_UPLOADED
4. Pipeline IA (automático vía BullMQ):
      a. PageIndex    → árbol jerárquico de secciones → Postgres (INDEXED)
      b. OpenKB       → wiki por empresa (cross-documento) → ANALYZED
      c. Kimi K2.6    → Dictamen IA: VLAP + hallazgos + resumen (AiDictamen)
5. Admin ve el dictamen IA → asigna un Assessor a la empresa
6. Assessor revisa en Split-View (/dashboard/review/company/[id])
      → Motor V.L.A.P. (4 criterios, Hard Stop < 85%)
      → Q&A con IA sobre documentos (OpenKB o PageIndex + NIM)
      → Hallazgos con tipo y severidad
      → Veredicto: APPROVED / CHANGES_REQUESTED / REJECTED
      → Si NON_COMPLIANCE → CAPA tickets (30 días) automáticos
7. Empresa ve el dictamen (/dashboard/documents/[id])
      → Si APPROVED → descarga Certificado ESG (HTML + SHA-256)
      → Si CAPA_OPEN → gestiona tickets en /dashboard/capa
8. Admin puede revocar un certificado (Kill-switch)
      → AuditLog: CERT_REVOKED
```

---

## Roles y permisos

| Acción | Empresa | Assessor | Admin |
|--------|---------|----------|-------|
| Subir documentos | Sí | No | No |
| Reprocesar documentos | No | Sí (solo asignadas) | Sí |
| Ver sus propios documentos | Sí | No aplica | Sí |
| Ver documentos de empresas asignadas | No | Sí | Sí (todos) |
| Q&A con IA sobre documentos | No | Sí (solo asignadas) | Sí |
| Ver dictamen IA preliminar | No | Sí (solo asignadas) | Sí |
| Emitir dictamen V.L.A.P. | No | Sí (solo asignadas) | Sí |
| Ver Audit Log | No | No | Sí |
| Exportar CSV | No | Sí (solo asignadas) | Sí |
| Asignar assessors a empresas | No | No | Sí |
| Revocar certificados (Kill-switch) | No | No | Sí |
| Ver Tickets CAPA | Solo propios | Empresas asignadas | Todos |

---

## Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|---------|
| `PrismaClientValidationError` en campo nuevo | Schema no aplicado | `npm run db:push` |
| Error `esgScore` no reconocido | Prisma Client no regenerado | `npm run db:generate` + reiniciar |
| Workers no procesan documentos | Redis no disponible | `docker compose up -d redis` |
| OpenKB no indexa documentos | Contenedor caído | `docker compose up -d openkb-api` |
| Q&A responde "No hay documentos indexados" | OpenKB KB vacío | Reprocesar el documento |
| Dictamen IA no se genera | NVIDIA_INTENT_API_KEY no configurada | Añadir al `.env` |
| Puerto 3000 ocupado | Proceso previo | `lsof -ti:3000 \| xargs kill -9` |
| Login falla con usuarios de prueba | Seed no ejecutado | `npx prisma db seed` |

---

## Variables de entorno — referencia

Ver `.env.example` para la lista completa con comentarios.

Las variables que **debes configurar manualmente**:
- `NEXTAUTH_SECRET` y `AUTH_SECRET` → genera con `openssl rand -base64 32`
- `NVIDIA_API_KEY` → pipeline de indexación
- `NVIDIA_INTENT_API_KEY` → dictamen IA con Kimi K2.6 (puede ser la misma)
- `NVIDIA_QA_API_KEY` → Q&A (puede ser la misma)

El resto tiene valores por defecto que funcionan con `docker compose up`.

Para la arquitectura completa del sistema ver [ARCHITECTURE.md](./ARCHITECTURE.md).
