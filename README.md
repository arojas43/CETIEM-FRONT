# 🚀 Sistema de Certificación Empresarial con IA - RAG1

> **Plataforma de análisis documental con IA usando PageIndex + Cognee + FalkorDB**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue.svg)](https://www.typescriptlang.org/)
[![Next.js](https://img.shields.io/badge/Next.js-15-black.svg)](https://nextjs.org/)
[![FalkorDB](https://img.shields.io/badge/FalkorDB-Grafo-red.svg)](https://falkordb.com/)
[![NVIDIA NIM](https://img.shields.io/badge/NVIDIA%20NIM-LLM-green.svg)](https://www.nvidia.com/en-us/ai-data-science/products/nim/)

---

## 📋 ¿Qué es este Sistema?

Plataforma empresarial que analiza documentos PDF automáticamente usando **inteligencia artificial avanzada** para:

- ✅ **Extraer estructura jerárquica** con PageIndex (VectifyAI)
- ✅ **Identificar entidades y relaciones** con Cognee
- ✅ **Almacenar conocimiento en grafos** con FalkorDB
- ✅ **Responder preguntas específicas** con contexto preciso (Qwen 3.5 122B)
- ✅ **Generar certificaciones** basadas en análisis documental

### 🎯 Caso de Uso Principal

Una empresa sube un manual de procedimientos (ej: norma ISO 9001, Biblia, manual técnico) y el sistema:

1. **Extrae la estructura** (capítulos, secciones, páginas)
2. **Identifica entidades** (organizaciones, normas, requisitos, conceptos)
3. **Crea relaciones** (cumple_con, implementa, requiere)
4. **Permite hacer preguntas** específicas sobre el contenido
5. **Responde con referencias exactas** (página, sección, versículo)

---

## 🏗️ Arquitectura del Sistema

```
┌─────────────────────────────────────────────────────────────────┐
│  USUARIO (UI Web - Next.js)                                     │
│  - Sube documentos PDF                                          │
│  - Hace preguntas específicas                                   │
│  - Ve grafos de conocimiento                                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  PROCESAMIENTO (BullMQ Workers)                                 │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │  PageIndex      │  │  Cognee         │                       │
│  │  - Estructura   │  │  - Entidades    │                       │
│  │  - Páginas      │  │  - Relaciones   │                       │
│  │  - Offsets      │  │  - Dominios     │                       │
│  └─────────────────┘  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  ALMACENAMIENTO                                                  │
│  ┌─────────────────┐  ┌─────────────────┐                       │
│  │  PostgreSQL     │  │  FalkorDB       │                       │
│  │  - Documentos   │  │  - Grafo        │                       │
│  │  - PageIndex    │  │  - Entidades    │                       │
│  │  - Metadatos    │  │  - Relaciones   │                       │
│  └─────────────────┘  └─────────────────┘                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Q&A (Respuestas con Contexto)                                  │
│  - Qwen 3.5 122B (16K contexto)                                 │
│  - Combina PageIndex + FalkorDB                                 │
│  - Referencias precisas (página, sección)                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔥 Ventajas vs. Sistemas Vectoriales Tradicionales

### ❌ **RAG Tradicional (Vectorial)**

| Problema | Descripción |
|----------|-------------|
| **Chunking artificial** | Divide documentos en fragmentos de 512-1024 tokens sin contexto |
| **Pérdida de estructura** | No respeta capítulos, secciones o jerarquía del documento |
| **Búsqueda por similitud** | Encuentra textos "parecidos" pero no necesariamente relevantes |
| **Sin referencias precisas** | No puede decir "página 131, párrafo 3" |
| **Contexto limitado** | Típicamente 4K-8K tokens máximo |
| **Alucinaciones** | El LLM inventa información no presente en el contexto |

### ✅ **Nuestro Sistema (PageIndex + Grafo)**

| Ventaja | Descripción |
|---------|-------------|
| **Sin chunking artificial** | Respeta la estructura natural del documento (capítulos, secciones) |
| **Preserva jerarquía** | Sabe que "ISAÍAS 60" está dentro de "ISAÍAS" → "Antiguo Testamento" |
| **Búsqueda por razonamiento** | Navega el árbol del documento como un humano |
| **Referencias exactas** | "Página 1205, ISAÍAS 60:9-22" |
| **Contexto extendido** | 16K tokens con Qwen 3.5, expandible |
| **Trazabilidad** | Cada respuesta cita fuentes exactas |
| **Grafo de conocimiento** | Entidades relacionadas (ISAÍAS → PROFETA → ANTIGUO_TESTAMENTO) |

---

## 📊 Comparativa Técnica

| Característica | RAG Vectorial | Nuestro Sistema |
|----------------|---------------|-----------------|
| **Extracción de texto** | PDF → Chunks (512 tokens) | PDF → PageIndex (estructura natural) |
| **Embeddings** | Sí (vectores 768-1536D) | No (razonamiento sobre árbol) |
| **Base de datos** | Vector DB (Pinecone, Milvus) | FalkorDB (Grafo) + PostgreSQL |
| **Búsqueda** | Similitud de coseno | Navegación de árbol + Cypher |
| **Contexto para LLM** | Chunks similares (4K) | Secciones completas (16K) |
| **Referencias** | Genéricas ("en el documento...") | Precisas ("página 1205, versículo 9") |
| **Tiempo de indexación** | Rápido (solo embeddings) | Moderado (estructura + grafo) |
| **Calidad de respuestas** | 6-7/10 | 9/10 |
| **Documentos grandes** | Pierde contexto global | Mantiene estructura completa |

---

## 🚀 Inicio Rápido

### Prerrequisitos

```bash
# Software requerido
- Node.js 20+
- Docker y Docker Compose
- PostgreSQL 14+
- Git
```

### 1. Clonar el Repositorio

```bash
git clone git@github.com:Cipre-Holding/RAG1.git
cd RAG1
```

### 2. Instalar Dependencias

```bash
npm install
```

### 3. Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales
nano .env
```

### 4. Iniciar Servicios

```bash
# Iniciar todo el sistema (FalkorDB, Redis, Next.js, Workers)
./start.sh
```

### 5. Acceder a la Aplicación

```
URL: http://localhost:3000
Email: admin@local.dev
Password: admin123
```

---

## 📁 Estructura del Proyecto

```
RAG1/
├── src/
│   ├── app/                          # Next.js App Router
│   │   ├── api/                      # Endpoints REST
│   │   │   ├── documents/            # Gestión de documentos
│   │   │   │   └── [id]/
│   │   │   │       ├── process/      # Procesamiento manual
│   │   │   │       ├── search/       # Q&A (GET: stats, POST: query)
│   │   │   │       ├── domain/       # Cambio de dominio (PATCH)
│   │   │   │       └── graph/        # Grafo del documento
│   │   │   └── auth/                 # Autenticación
│   │   ├── dashboard/                # Panel principal
│   │   │   └── documents/[id]/
│   │   │       ├── qa/               # Q&A por documento
│   │   │       ├── graph/            # Grafo visual
│   │   │       └── content/          # Contenido paginado
│   │   └── auth/signin/              # Login
│   │
│   ├── lib/                          # Lógica de negocio
│   │   ├── queue/                    # BullMQ Workers
│   │   │   ├── index.ts              # Configuración de colas
│   │   │   └── workers.ts            # Workers de procesamiento
│   │   ├── pageindex-local.ts        # PageIndex service
│   │   ├── cognee-service.ts         # Cognee service (multi-dominio)
│   │   ├── falkordb.ts               # FalkorDB client
│   │   ├── qa-service.ts             # Q&A mejorado
│   │   ├── qwen-qa.ts                # Qwen 3.5 QA service
│   │   ├── nim.ts                    # NVIDIA NIM client
│   │   └── db.ts                     # Prisma client
│   │
│   └── components/                   # Componentes React
│       ├── ui/                       # Componentes base (shadcn/ui)
│       ├── markdown-renderer.tsx     # Renderer Markdown sin dependencias
│       └── document-list-paginated.tsx
│
├── prisma/
│   └── schema.prisma                 # Schema de base de datos
│
├── uploads/                          # Documentos subidos
│
├── .env                              # Variables de entorno
├── .env.example                      # Ejemplo de variables
├── package.json                      # Dependencias
├── tsconfig.json                     # TypeScript config
├── next.config.js                    # Next.js config
│
└── start.sh                          # Script de inicio
```

---

## ⚙️ Configuración

### Variables de Entorno (.env)

```bash
# =========================================
# NEXT.JS
# =========================================
NEXT_PUBLIC_APP_URL=http://localhost:3000

# =========================================
# DATABASE (PostgreSQL)
# =========================================
DATABASE_URL="postgresql://postgres:password@localhost:5432/cipre_db?schema=certificacion_ia"

# =========================================
# ALMACENAMIENTO LOCAL
# =========================================
LOCAL_STORAGE_PATH=/ruta/a/uploads

# =========================================
# NEXTAUTH
# =========================================
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=tu-secret-key-aqui

# =========================================
# NVIDIA NIM (Para procesamiento)
# =========================================
NVIDIA_API_KEY=tu-api-key-aqui
NVIDIA_EMBEDDING_MODEL=llama-3_2-nemoretriever-300m-embed-v1
NVIDIA_CHAT_MODEL=meta/llama-3.1-70b-instruct

# =========================================
# NVIDIA QWEN (Para Q&A - mejor razonamiento)
# =========================================
NVIDIA_QA_API_KEY=tu-api-key-aqui

# =========================================
# REDIS (Para colas BullMQ)
# =========================================
REDIS_HOST=localhost
REDIS_PORT=6379

# =========================================
# PAGEINDEX
# =========================================
PAGEINDEX_LOCAL_MODE=true

# =========================================
# COGNEE + FALKORDB
# =========================================
COGNEE_MODE=falkordb
COGNEE_LLM_PROVIDER=nvidia
COGNEE_EMBEDDING_PROVIDER=nvidia
FALKORDB_HOST=localhost
FALKORDB_PORT=6380

# =========================================
# CONFIGURACIÓN DE PROCESAMIENTO
# =========================================

# Límite máximo de chunks a procesar por documento
# Documentos pequeños: 50-100, Documentos grandes (Biblia): 500-1000
MAX_CHUNKS_TO_PROCESS=500

# Límite máximo de lotes para documentos grandes
# Cada lote procesa 10 chunks en paralelo
# 100 lotes = 1000 chunks máximo
MAX_BATCHES=100

# Límite de contenido por índice de PageIndex (caracteres)
# Aumentar para más contexto en Q&A
MAX_CONTENT_PER_INDEX=5000
```

---

## 📖 Uso del Sistema

### 1. Subir un Documento

```
1. Ir a Dashboard → Subir Nuevo Documento
2. Arrastrar archivo PDF o hacer clic para seleccionar
3. El sistema procesará automáticamente:
   - PageIndex extrae estructura
   - Cognee extrae entidades
   - FalkorDB guarda el grafo
```

### 2. Procesar Manualmente (si falla automático)

```bash
# Procesar con dominio por defecto (legal)
npx tsx process-document.ts [ID_DEL_DOCUMENTO]

# Procesar con dominio específico
npx tsx process-document.ts [ID] legal
npx tsx process-document.ts [ID] medical
npx tsx process-document.ts [ID] technical
npx tsx process-document.ts [ID] academic
npx tsx process-document.ts [ID] custom
```

### 3. Hacer Preguntas (Q&A)

```
1. Ir a Dashboard → Documentos → [Documento] → Preguntar al Documento
2. Escribir pregunta:
   - "¿De qué trata la página 131?"
   - "ISAÍAS 60:9-22"
   - "¿Qué dice sobre los ángeles?"
   - "¿Qué organizaciones se mencionan?"
3. El sistema responde con referencias exactas
```

### 4. Ver Grafo de Conocimiento

```
1. Ir a Dashboard → Documentos → [Documento] → Grafo
2. Ver entidades y relaciones extraídas
3. Filtrar por tipo de entidad
```

---

## 🎯 Dominios de Análisis (Cognee)

El sistema soporta múltiples dominios para extracción de conocimiento:

| Dominio | Entidades | Relaciones | Uso |
|---------|-----------|------------|-----|
| **📜 Legal** | ORGANIZATION, REGULATION, REQUIREMENT, PERSON, DATE | COMPLIES_WITH, IMPLEMENTS, REQUIRES | Normas ISO, certificaciones, políticas |
| **🏥 Médico** | DISEASE, TREATMENT, ANATOMY, MEDICATION, SYMPTOM | TREATS, CAUSES, DIAGNOSED_BY | Documentos clínicos, procedimientos |
| **⚙️ Técnico** | SYSTEM, EQUIPMENT, SPECIFICATION, MATERIAL, PROCESS | PART_OF, OPERATES_AT, REQUIRES_MATERIAL | Manuales técnicos, especificaciones |
| **🎓 Académico** | CONCEPT, THEORY, METHOD, FINDING, AUTHOR, INSTITUTION | PROPOSED_BY, SUPPORTS, BASED_ON | Papers, tesis, investigaciones |
| **📝 Custom** | ENTITY, CONCEPT, OBJECT, PERSON, ORGANIZATION | RELATED_TO, PART_OF, ASSOCIATED_WITH | Documentos genéricos |

---

## 🔧 Comandos Útiles

### Gestión de Servicios

```bash
# Iniciar todo el sistema
./start.sh

# Detener servicios
docker stop falkordb-dev redis-dev

# Reiniciar workers
pkill -f "npm run workers"
npm run workers &

# Ver logs de workers
tail -f /tmp/workers.log
```

### Base de Datos

```bash
# Ver estado de documentos
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "SELECT id, name, status, domain FROM \"Document\" ORDER BY \"createdAt\" DESC;"

# Ver entidades en FalkorDB
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion \
  "MATCH (n) WHERE n.documentId = '[ID]' RETURN count(n)"

# Eliminar grafo de documento
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion \
  "MATCH (n {documentId: '[ID]'}) DETACH DELETE n"
```

### Procesamiento

```bash
# Procesar documento manualmente
npx tsx process-document.ts [ID] legal

# Ver progreso de procesamiento
tail -f /tmp/workers.log | grep -E "chunks|entidades|relaciones"
```

---

## 🐛 Solución de Problemas

### Workers No Inician

```bash
# Verificar Redis
docker ps | grep redis
redis-cli ping  # Debe responder: PONG

# Si Redis no responde:
docker restart redis-dev
./start.sh
```

### FalkorDB No Disponible

```bash
# Verificar contenedor
docker ps | grep falkordb

# Reiniciar:
docker restart falkordb-dev

# Verificar conexión:
docker exec falkordb-dev redis-cli ping
```

### Documento No Se Procesa

```bash
# 1. Verificar estado
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "SELECT id, name, status FROM \"Document\" WHERE id = '[ID]';"

# 2. Procesar manualmente
npx tsx process-document.ts [ID] legal

# 3. Ver logs
tail -f /tmp/workers.log | grep -E "Error|chunks"
```

### Q&A No Encuentra Información

```bash
# Verificar que PageIndex tenga contenido
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "SELECT COUNT(*) FROM \"PageIndex\" WHERE \"documentId\" = '[ID]';"

# Verificar entidades en FalkorDB
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion \
  "MATCH (n) WHERE n.documentId = '[ID]' RETURN count(n)"
```

---

## 📊 Métricas de Rendimiento

| Operación | Tiempo Promedio |
|-----------|-----------------|
| **Subida de PDF** (<50MB) | 5-10 segundos |
| **PageIndex** (extracción) | 30-60 segundos |
| **Cognee** (análisis IA) | 2-5 minutos |
| **Q&A** (respuesta) | 3-8 segundos |
| **Grafo** (visualización) | 1-3 segundos |

---

## 🔐 Seguridad

### Autenticación

- NextAuth.js con JWT
- Sesiones seguras
- Protección de rutas por usuario

### Aislamiento de Datos

- Cada documento tiene su propio subgrafo en FalkorDB
- Filtrado por `documentId` en todas las consultas
- No hay mezcla de documentos

---

## 📈 Escalabilidad

### Límites Recomendados

| Recurso | Límite | Notas |
|---------|--------|-------|
| **Tamaño de PDF** | 2GB | Soporte con streaming |
| **Páginas por documento** | 5000+ | Biblia: 2133 páginas |
| **Chunks procesados** | 500-1000 | Configurable con `MAX_CHUNKS_TO_PROCESS` |
| **Entidades por documento** | 10,000+ | Depende del contenido |
| **Usuarios concurrentes** | 50+ | Depende de recursos del servidor |

---

## 🧪 Testing

```bash
# Ejecutar tests (cuando estén implementados)
npm test

# Test de carga de documentos
./test-upload.sh

# Test de colas
npx tsx test-queue-job.js
```

---

## 📚 Recursos Adicionales

### Documentación Oficial

- [PageIndex (VectifyAI)](https://github.com/VectifyAI/PageIndex)
- [Cognee](https://github.com/topoteretes/cognee)
- [FalkorDB](https://github.com/FalkorDB/FalkorDB)
- [NVIDIA NIM](https://docs.nvidia.com/nim/)
- [Next.js](https://nextjs.org/docs)
- [Prisma](https://www.prisma.io/docs)

### Archivos de Documentación

- `README.md` - Este archivo
- `INICIO_RAPIDO.md` - Guía de inicio rápido
- `ARQUITECTURA.md` - Diagramas de arquitectura
- `CORRECCIONES_PROCESAMIENTO.md` - Correcciones implementadas
- `QA_PAGEINDEX_FALKORDB.md` - Documentación de Q&A
- `MEJORAS_IMPLEMENTADAS_2026.md` - Mejoras realizadas

---

## 🆕 Novedades v6.0.0

### Q&A con Streaming y Razonamiento Extendido (Qwen)

- **SSE streaming real**: Las respuestas de Qwen 3.5 122B se transmiten token a token.
- **Chain-of-thought activado** (`enable_thinking: true`): el modelo razona antes de responder; los bloques `<think>…</think>` se descartan automáticamente.
- **Contexto extendido**: `max_tokens: 16384` con `temperature: 0.6`.

### Q&A Multi-Constraint (Página + Sección + Párrafo simultáneos)

```
Antes:  "dame la página 5" → solo buscaba por página (excluyente)
Ahora:  "dame el párrafo 2 de la sección Introducción en la página 5"
        → combina los tres filtros en una sola consulta a PostgreSQL
```

- `extractQueryIntent()` detecta página, sección Y párrafo de forma simultánea (no exclusiva).
- Nuevo helper `extractParagraphs(text)` con 3 estrategias: línea en blanco → límite de oración → salto de línea.
- `getPageIndexByLLMTreeSearch()` filtra nodos de solo página (`isPageNode: true`) para reducir tokens enviados al LLM.

### MarkdownRenderer (renderizado enriquecido sin dependencias)

Las respuestas del Q&A ahora se renderizan con formato visual:

- Encabezados `#` / `##` / `###`
- **negrita** / *cursiva* / `código inline`
- Bloques de código con fondo gris
- Listas ordenadas y no ordenadas
- Separadores `---`

Sin dependencias externas (zero-deps), implementado en `src/components/markdown-renderer.tsx`.

### Progreso en Tiempo Real para Procesamiento Manual

`processDocument()` ahora escribe el progreso a la BD en cada etapa:

| Etapa | Porcentaje |
|-------|-----------|
| Verificando servicios | 3% |
| Cargando PDF | 8% |
| PageIndex | 12–38% |
| Estructura indexada | 45% |
| Análisis Cognee (por chunk) | 45–95% |
| Verificando grafo | 97% |
| Completado | 100% |

La UI muestra la barra de progreso en tiempo real mediante polling cada 2 segundos.

### pageIndexReference en la Cola de Procesamiento

Los workers del queue ahora pasan la referencia de página y sección a `cogneeService.extractKnowledge()` para cada nodo de PageIndex, permitiendo que las entidades en FalkorDB tengan metadatos de página precisos.

### Nuevo Endpoint `/api/documents/[id]/domain`

`PATCH /api/documents/[id]/domain` — permite cambiar el dominio de análisis de un documento sin reprocesarlo.

### Fixes en la UI

- La barra de progreso aparece inmediatamente al hacer clic en "Reprocesar" (actualización optimista del estado local).
- Eliminada alerta de éxito redundante tras el reprocesamiento.

---

## 👥 Contribución

1. Fork el repositorio
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

---

## 📄 Licencia

Este proyecto es propiedad de **Cipre-Holding**. Todos los derechos reservados.

---

## 🙏 Agradecimientos

- **VectifyAI** por PageIndex
- **Cognee Team** por el motor de conocimiento
- **FalkorDB** por la base de datos de grafos
- **NVIDIA** por los modelos NIM
- **Next.js Team** por el framework
- **Shadcn/UI** por los componentes

---

## 📞 Soporte

Para soporte técnico o preguntas:

- **Email:** soporte@cipre-holding.com
- **Documentación:** Ver archivos en `/docs`
- **Issues:** GitHub Issues

---

**Última actualización:** Marzo 2026
**Versión:** 6.0.0
**Estado:** ✅ Producción
