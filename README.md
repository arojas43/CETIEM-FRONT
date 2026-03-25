# CETIEM — Plataforma de Certificación Empresarial ESG con IA

Sistema de auditoría y certificación ESG asistido por inteligencia artificial. Las empresas suben documentos, el sistema los procesa con IA (PageIndex + Cognee + FalkorDB), y los Data Assessors emiten dictámenes formales con el motor V.L.A.P.

---

## Usuarios de prueba

| Email | Contraseña | Rol | Empresa |
|-------|-----------|-----|---------|
| `admin@cetiem.mx` | `cetiem2024` | Super Admin | CETIEM S.C. |
| `assessor@cetiem.mx` | `cetiem2024` | Data Assessor | CETIEM S.C. |
| `empresa1@cetiem.mx` | `cetiem2024` | Empresa | Empresa Demo S.A. de C.V. |
| `empresa2@cetiem.mx` | `cetiem2024` | Empresa | Industrias Beta S.A. |

Para recrear los usuarios en cualquier entorno:
```bash
npx prisma db seed
```

---

## Stack tecnológico

| Capa | Tecnología |
|------|-----------|
| Framework | Next.js 15 (App Router), React 19, TypeScript 5.6 |
| Base de datos | PostgreSQL + Prisma 6 |
| Autenticación | NextAuth v5 beta (JWT, CredentialsProvider, bcryptjs) |
| IA / LLM | NVIDIA NIM · z-ai/GLM4.7 |
| Grafo de conocimiento | FalkorDB (puerto 6380) + Cognee |
| Indexación | PageIndex (jerarquía semántica de PDFs) |
| Cola de tareas | BullMQ + Redis (ioredis, puerto 6379) |
| Almacenamiento | Local (uploads/) en dev · Google Cloud Storage en prod |
| OCR | Tesseract.js (fallback cuando pdf-parse falla) |
| UI | Tailwind CSS (tokens CETIEM dark theme) · Lucide Icons |

---

## Roles del sistema

| Rol | Descripción | Acceso |
|-----|-------------|--------|
| COMPANY | Empresa que sube documentos y hace seguimiento de su certificación ESG | Dashboard, Mis Documentos, Subir, Tickets CAPA |
| ASSESSOR | Data Assessor CETIEM que revisa la cola y emite dictámenes V.L.A.P. | Cola, Revisión Split-View, Empresas, CAPA, Grafo |
| ADMIN | Súper administrador con acceso total | Todo lo anterior + Assessors, Logs, Exportar CSV, Kill-switch |

---

## Sectores certificables

| Track | Dominio IA | Descripción |
|-------|-----------|-------------|
| Track A | INDUSTRIA | Sector industrial: manufactura, logística, procesos productivos |
| Track B | CONSTRUCCION | Sector construcción: obra civil, arquitectura, contratistas |
| Track C | TECNOLOGIA | Tecnología y servicios: software, consultoría, servicios digitales |

---

## Instalación rápida

### Prerrequisitos

- Node.js 20+
- PostgreSQL corriendo (local o remoto)
- Redis en localhost:6379 (para BullMQ)
- FalkorDB en localhost:6380

```bash
# FalkorDB en Docker
docker run -d --name falkordb-dev \
  -p 6380:6379 -p 3001:3000 \
  -v $(pwd)/falkordb-data:/var/lib/falkordb/data \
  falkordb/falkordb --stop-writes-on-bgsave-error no

# Redis en Docker
docker run -d --name redis-dev \
  -p 6379:6379 -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes
```

### Variables de entorno

```env
DATABASE_URL="postgresql://usuario:contraseña@localhost:5432/cipre_db?schema=certificacion_ia"
AUTH_SECRET="una-clave-secreta-aleatoria-larga"
NEXTAUTH_URL="http://localhost:3000"
NVIDIA_API_KEY="nvapi-xxxxxxxxxxxxxxxxxxxx"
NVIDIA_QA_API_KEY="nvapi-xxxxxxxxxxxxxxxxxxxx"
REDIS_HOST=localhost
REDIS_PORT=6379
FALKORDB_HOST=localhost
FALKORDB_PORT=6380
LOCAL_STORAGE_PATH="./uploads"
MAX_CHUNKS_TO_PROCESS=500
```

### Comandos

```bash
npm install              # Instalar dependencias
npx prisma db push       # Aplicar schema a la BD
npx prisma db seed       # Crear usuarios de prueba
npm run dev              # Servidor Next.js (puerto 3000)
npm run workers          # Workers BullMQ (terminal separada)
```

---

## Funcionalidades implementadas

### Autenticación y registro

| # | Funcionalidad | Estado |
|---|---------------|--------|
| 1 | Login con email y contraseña (bcrypt) | OK |
| 2 | Sesión JWT con rol incluido en el token | OK |
| 3 | Protección de rutas por sesión y rol | OK |
| 4 | Registro self-service de empresas con selección de Track Sectorial | OK |
| 5 | Validación de email duplicado al registrar | OK |
| 6 | Formulario multi-paso: datos → track → confirmación | OK |

### Gestión de documentos (Empresa)

| # | Funcionalidad | Estado |
|---|---------------|--------|
| 7 | Subida de PDF con drag-and-drop + validación tipo/tamaño | OK |
| 8 | Hash SHA-256 calculado en upload para integridad forense | OK |
| 9 | Lista paginada con filtros por estado y búsqueda | OK |
| 10 | Badge de estado de certificación en la lista | OK |
| 11 | Empresa NO puede reprocesar — solo subir un nuevo documento | OK |
| 12 | Descarga del Certificado ESG si está APPROVED | OK |
| 13 | Alerta CAPA prominente en dashboard si hay tickets abiertos | OK |

### Procesamiento IA (Assessor / Admin)

| # | Funcionalidad | Estado |
|---|---------------|--------|
| 14 | Cola BullMQ para procesamiento en background | OK |
| 15 | Extracción PDF (pdf-parse + OCR Tesseract fallback) | OK |
| 16 | Indexación jerárquica PageIndex (secciones, páginas) | OK |
| 17 | Extracción de entidades y relaciones Cognee → FalkorDB | OK |
| 18 | Dominios: Industria / Construcción / Tecnología | OK |
| 19 | Modos de extracción: Auto / Mixto / Dirigido | OK |

### Motor V.L.A.P. + Auditoría (Assessor)

| # | Funcionalidad | Estado |
|---|---------------|--------|
| 20 | Consola Split-View: PDF izquierda + formulario derecha | OK |
| 21 | Validación 4 criterios: Vigencia, Legibilidad, Autoría, Pertinencia | OK |
| 22 | Puntuación de confianza 0-100% por criterio | OK |
| 23 | Hard Stop: bloquea emisión si criterio < 85% sin override | OK |
| 24 | ESG Score = (criterios pasados / 4) × 100 | OK |
| 25 | Hallazgos con tipo y severidad (LOW/MEDIUM/HIGH/CRITICAL) | OK |
| 26 | CAPA automático: ticket 30 días por NON_COMPLIANCE | OK |
| 27 | Veredicto: Aprobar / Solicitar Cambios / Rechazar | OK |

### Certificado ESG

| # | Funcionalidad | Estado |
|---|---------------|--------|
| 28 | Certificado HTML auto-imprimible con datos formales | OK |
| 29 | Sello SHA-256 para integridad forense | OK |
| 30 | Token público UUID para verificación | OK |
| 31 | Kill-switch CERT_REVOKED (Admin) con audit log | OK |

### Administración

| # | Funcionalidad | Estado |
|---|---------------|--------|
| 32 | Empresas con Track, Sprint, assessor asignado, cert status | OK |
| 33 | Asignación empresa → Assessor con audit log | OK |
| 34 | Lista de Assessors con estadísticas de empresas y aprobaciones | OK |
| 35 | Audit Log inmutable: paginado, color-coded | OK |
| 36 | Exportación CSV de todos los documentos | OK |

---

## Solución de problemas

| Error | Solución |
|-------|---------|
| Campo no reconocido (esgScore, etc.) | npx prisma db push && npm run db:generate, reiniciar dev server |
| FalkorDB rechaza escrituras | docker exec falkordb-dev redis-cli CONFIG SET stop-writes-on-bgsave-error no |
| Puerto 3000 ocupado | lsof -ti:3000 \| xargs kill -9 |
| Prisma Client desactualizado | npm run db:generate |
| Redis no responde | docker restart redis-dev |
| Respuestas en chino (GLM4.7) | Verificar system prompt "Responde SIEMPRE en español" |
