# RAG1 — Sistema de Certificación Empresarial con IA

Plataforma de análisis documental que combina **PageIndex** (extracción jerárquica de PDFs), **Cognee** (extracción de entidades/relaciones) y **FalkorDB** (grafo de conocimiento) para responder preguntas sobre documentos con precisión de página y sección.

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend + API | Next.js 15 (App Router) |
| Base de datos | PostgreSQL + Prisma ORM |
| Grafo de conocimiento | FalkorDB (puerto 6380) |
| Colas de trabajo | Redis + BullMQ (puerto 6379) |
| LLM procesamiento | NVIDIA NIM — Llama 3.1 70B |
| LLM respuestas Q&A | NVIDIA NIM — Qwen 3.5 122B |
| Extracción PDF | pdfjs-dist + Tesseract OCR |
| Auth | NextAuth v5 |

---

## Requisitos

- Node.js 20+
- Docker 20+
- PostgreSQL 15 (puede correr en Docker)
- Cuenta NVIDIA NIM con dos API Keys (una para Llama, otra para Qwen)

---

## Instalación rápida

```bash
git clone git@github.com:Cipre-Holding/RAG1.git
cd RAG1
npm install
cp .env.example .env   # editar con tus valores
mkdir -p uploads
./start.sh
```

La app queda en `http://localhost:3000`.

---

## Configurar `.env`

Copia `.env.example` a `.env` y ajusta:

```env
# URL pública de la app (cambiar si no es localhost)
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000

# Genera un secreto único: openssl rand -base64 32
NEXTAUTH_SECRET=tu-secreto-aqui

# PostgreSQL
DATABASE_URL="postgresql://postgres:password@localhost:5432/cipre_db?schema=certificacion_ia"

# Ruta absoluta donde se guardan los PDFs subidos
LOCAL_STORAGE_PATH=/ruta/absoluta/a/RAG1/uploads

# NVIDIA NIM — procesamiento (Llama 3.1 70B)
NVIDIA_API_KEY=nvapi-...
NVIDIA_CHAT_MODEL=meta/llama-3.1-70b-instruct
NVIDIA_EMBEDDING_MODEL=llama-3_2-nemoretriever-300m-embed-v1

# NVIDIA NIM — Q&A (Qwen 3.5 122B)
NVIDIA_QA_API_KEY=nvapi-...

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# FalkorDB
FALKORDB_HOST=localhost
FALKORDB_PORT=6380

# Límite de chunks a procesar por documento (ajustar según capacidad)
MAX_CHUNKS_TO_PROCESS=500
```

---

## Instalar en otro dispositivo

### 1. Instalar dependencias del sistema

**Ubuntu / Debian:**
```bash
# Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
```

**macOS:**
```bash
brew install node@20
brew install --cask docker
```

**Windows:**
- Node.js 20: https://nodejs.org/
- Docker Desktop: https://www.docker.com/products/docker-desktop

### 2. PostgreSQL (si no tienes uno ya corriendo)

```bash
docker run -d \
  --name postgres-dev \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=cipre_db \
  -p 5432:5432 \
  postgres:15-alpine
```

### 3. Valores del `.env` que siempre debes cambiar

```env
LOCAL_STORAGE_PATH=/ruta/nueva/RAG1/uploads   # ruta real en el nuevo equipo
NEXTAUTH_SECRET=nuevo-secreto                  # openssl rand -base64 32
DATABASE_URL=...                               # apuntar al postgres correcto
NEXT_PUBLIC_APP_URL=http://IP_SERVIDOR:3000   # si no es localhost
NEXTAUTH_URL=http://IP_SERVIDOR:3000
```

### 4. Inicializar base de datos

```bash
npm run db:generate
npm run db:push
```

### 5. Levantar todo

```bash
./start.sh
```

El script levanta FalkorDB y Redis en Docker, inicia los workers y arranca Next.js en modo desarrollo.

---

## Iniciar manualmente (sin start.sh)

```bash
# FalkorDB
docker run -d --name falkordb-dev \
  -p 6380:6379 -p 3001:3000 \
  -v $(pwd)/falkordb-data:/var/lib/falkordb/data \
  falkordb/falkordb --stop-writes-on-bgsave-error no

# Redis
docker run -d --name redis-dev \
  -p 6379:6379 -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes

# Workers BullMQ (terminal separada)
npm run workers

# Next.js (terminal separada)
npm run dev
```

---

## Comandos útiles

```bash
npm run dev          # Servidor de desarrollo
npm run build        # Build de producción
npm run workers      # Workers de procesamiento
npm run db:generate  # Regenerar Prisma Client
npm run db:push      # Aplicar schema a PostgreSQL
npm run db:studio    # Prisma Studio (visualizar BD en browser)
```

---

## Acceso por defecto

| | |
|---|---|
| App | http://localhost:3000 |
| Email | admin@local.dev |
| Password | admin123 |
| FalkorDB UI | http://localhost:3001 |

---

## Solución de problemas

| Error | Solución |
|-------|---------|
| FalkorDB rechaza escrituras (MISCONF) | `docker exec falkordb-dev redis-cli CONFIG SET stop-writes-on-bgsave-error no` |
| Puerto 3000 ocupado | `lsof -ti:3000 \| xargs kill -9` |
| Prisma Client desactualizado | `npm run db:generate` |
| Redis no responde | `docker restart redis-dev` |
| Error `border-border` en Tailwind | Asegúrate de tener solo un bloque `colors` en `tailwind.config.js` |

---

## Estructura del proyecto

```
src/
├── app/
│   ├── api/
│   │   └── documents/     # Upload, process, search, graph
│   ├── dashboard/         # UI principal
│   └── auth/
├── components/
└── lib/
    ├── pageindex-real.ts          # Extracción jerárquica PDF (pdfjs-dist)
    ├── cognee-service.ts          # Extracción entidades/relaciones
    ├── falkordb.ts                # Cliente FalkorDB
    ├── qa-service.ts              # Pipeline Q&A
    ├── qwen-qa.ts                 # Qwen 3.5 122B streaming
    ├── nim.ts                     # NVIDIA NIM (Llama 3.1)
    ├── process-document-service.ts
    └── queue/
        ├── index.ts               # Colas BullMQ
        └── workers.ts             # Entry point workers
```

---

- [ARQUITECTURA.md](ARQUITECTURA.md) — Flujo técnico completo del sistema
- [GUIA_USO.md](GUIA_USO.md) — Cómo usar la plataforma
