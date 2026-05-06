# SECRETARIA DE ECONOMIA — Plataforma de Certificación Empresarial ESG con IA

Sistema de auditoría y certificación ESG asistido por inteligencia artificial. Las empresas suben documentos, el sistema los procesa con IA (PageIndex + Cognee + FalkorDB), y los Data Assessors emiten dictámenes formales con el motor V.L.A.P.

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

Abre `.env` y rellena **solo estas dos variables** (el resto lo maneja Docker):

| Variable | Dónde obtenerla |
|----------|----------------|
| `NVIDIA_API_KEY` | [build.nvidia.com](https://build.nvidia.com) → API Key (plan gratuito disponible) |
| `NVIDIA_QA_API_KEY` | Puede ser la misma que `NVIDIA_API_KEY` |

### 3. Levantar todo

```bash
docker compose up --build
```

Esto levanta **todos los servicios** automáticamente:
- Build de la aplicación Next.js
- Migración y seed de la base de datos (usuarios de prueba incluidos)
- Workers BullMQ para procesamiento de documentos con IA
- PostgreSQL, Redis, FalkorDB, FalkorDB Browser

| URL | Descripción |
|-----|-------------|
| `http://localhost:3000` | Aplicación principal |
| `http://localhost:3001` | FalkorDB Browser — explorador visual del grafo |

> **Nota:** El primer `docker compose up --build` tarda ~3 minutos en compilar la imagen.
> Las siguientes veces usa `docker compose up` (sin `--build`) y arranca en segundos.

---

## Usuarios de prueba

| Email | Contraseña | Rol |
|-------|-----------|-----|
| `admin@secretaria-economia.mx` | `secretaria-economia2024` | Super Admin |
| `assessor@secretaria-economia.mx` | `secretaria-economia2024` | Data Assessor |
| `empresa1@secretaria-economia.mx` | `secretaria-economia2024` | Empresa (Track A — Industria) |
| `empresa2@secretaria-economia.mx` | `secretaria-economia2024` | Empresa (Track B — Construcción) |

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
| UI | Tailwind CSS (tokens SECRETARIA DE ECONOMIA dark theme) · Lucide Icons |

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
│   │   ├── sidebar.tsx              ← Navegación por rol
│   │   ├── document-list-paginated.tsx
│   │   └── pdf-inline-viewer.tsx    ← Visor PDF inline con toggle
│   └── lib/
│       ├── auth.ts           ← Config NextAuth
│       ├── audit.ts          ← logAudit() append-only
│       ├── access.ts         ← canAccessDocument / canAccessCompany (control de acceso por rol)
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
| Subir documentos | Sí | No | No |
| Reprocesar documentos | No | Sí (solo asignadas) | Sí |
| Ver sus propios documentos | Sí | No aplica | Sí |
| Ver documentos de empresas asignadas | No | Sí | Sí (todos) |
| Usar Q&A / Grafo de conocimiento | No | Sí (solo asignadas) | Sí |
| Emitir dictamen V.L.A.P. | No | Sí (solo asignadas) | Sí |
| Ver Audit Log | No | No | Sí |
| Exportar CSV | No | Sí (solo asignadas) | Sí |
| Asignar assessors a empresas | No | No | Sí |
| Revocar certificados (Kill-switch) | No | No | Sí |
| Ver Tickets CAPA | Solo propios | Empresas asignadas | Todos |
| Dashboard: stats globales | Propios | Empresas asignadas | Sistema completo |

---

## Solución de problemas comunes

| Síntoma | Causa probable | Solución |
|---------|---------------|---------|
| Error `esgScore` no reconocido | Prisma Client no regenerado | `npm run db:generate` + reiniciar servidor |
| `PrismaClientValidationError` en campo nuevo | Schema no aplicado a la BD | `npm run db:push` |
| FalkorDB rechaza escrituras (MISCONF) | Config Redis en FalkorDB | `docker exec secretaria-economia-falkordb redis-cli CONFIG SET stop-writes-on-bgsave-error no` |
| Q&A responde en chino | GLM4.7 sin instrucción de idioma | Verificar system prompt en `lib/qwen-qa.ts` |
| Workers no procesan documentos | Redis no disponible | `docker compose up -d redis` |
| Puerto 3000 ocupado | Proceso previo | `lsof -ti:3000 \| xargs kill -9` |
| Login falla con usuarios de prueba | Seed no ejecutado | `npx prisma db seed` |
| FalkorDB Browser no carga en 3001 | Primera vez (imagen lenta) | Espera ~30s o `docker compose logs falkordb-browser` |
| `Cannot find module 'falkordb'` | Dependencias no instaladas | `npm install` (el paquete oficial es `falkordb`, no ioredis) |

---

## Variables de entorno — referencia completa

Ver `.env.example` para la lista completa con comentarios explicativos.

Las únicas variables que **debes configurar manualmente** son:
- `NEXTAUTH_SECRET` y `AUTH_SECRET` → genera con `openssl rand -base64 32`
- `NVIDIA_API_KEY` y `NVIDIA_QA_API_KEY` → crea cuenta en [build.nvidia.com](https://build.nvidia.com)

El resto tiene valores por defecto que funcionan con `docker compose up -d`.
