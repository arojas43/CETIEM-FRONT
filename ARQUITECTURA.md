# 🏗️ Arquitectura del Sistema

## Vista General

```
┌─────────────────────────────────────────────────────────────────────────┐
│                            USUARIO FINAL                                 │
│                         (Navegador Web)                                  │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    │ http://localhost:3000
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           CAPA WEB (Next.js)                             │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │
│  │   Dashboard  │  │  Subida PDF  │  │  Certificados│                  │
│  └──────────────┘  └──────────────┘  └──────────────┘                  │
│                                                                          │
│  ┌────────────────────────────────────────────────────────────┐         │
│  │                    API Routes (Backend)                     │         │
│  │  /api/documents  │  /api/auth  │  /api/files               │         │
│  └────────────────────────────────────────────────────────────┘         │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌──────────────────────────┐          ┌──────────────────────────┐
│   COLA DE TRABAJOS       │          │   BASE DE DATOS          │
│      (Redis)             │          │   (PostgreSQL)           │
│   Puerto: 6379           │          │   Puerto: 5432           │
│                          │          │                          │
│  ┌────────────────────┐  │          │  ┌────────────────────┐  │
│  │ document-processing│  │          │  │ users              │  │
│  │ ai-analysis        │  │          │  │ documents          │  │
│  │ report-generation  │  │          │  │ page_indices       │  │
│  └────────────────────┘  │          │  │ certifications     │  │
│                          │          │  └────────────────────┘  │
└──────────────────────────┘          └──────────────────────────┘
            │                                     │
            ▼                                     ▼
┌──────────────────────────────────────────────────────────────────────┐
│                        WORKERS (Procesamiento)                        │
│                                                                       │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐       │
│  │  Document Worker│  │   AI Worker     │  │  Report Worker  │       │
│  │                 │  │                 │  │                 │       │
│  │  • Lee PDF      │  │  • Analiza con  │  │  • Genera PDF   │       │
│  │  • Extrae texto │  │    NVIDIA NIM   │  │  • Exporta      │       │
│  │  • Crea índice  │  │  • Extrae       │  │  • Formatea     │       │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘       │
└──────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │                               │
                    ▼                               ▼
┌──────────────────────────┐          ┌──────────────────────────┐
│   GRAFO DE CONOCIMIENTO  │          │   SERVICIOS EXTERNOS     │
│     (FalkorDB)           │          │     (NVIDIA NIM)         │
│   Puerto: 6380           │          │   API HTTPS              │
│   UI: 3001               │          │                          │
│                          │          │  ┌────────────────────┐  │
│  ┌────────────────────┐  │          │  │ Llama 3.1 70B      │  │
│  │  Nodos:            │  │          │  │ • Análisis texto   │  │
│  │  • ORGANIZATION    │  │          │  │ • Estructura PDF   │  │
│  │  • REGULATION      │  │          │  │ • Extracción       │  │
│  │  • REQUIREMENT     │  │          │  └────────────────────┘  │
│  │  • DOCUMENT        │  │          │                          │
│  └────────────────────┘  │          └──────────────────────────┘
│                          │
│  ┌────────────────────┐  │
│  │  Relaciones:       │  │
│  │  • COMPLIES_WITH   │  │
│  │  • IMPLEMENTS      │  │
│  │  • REQUIRES        │  │
│  └────────────────────┘  │
└──────────────────────────┘
```

---

## Flujo de Datos: Subida de Documento

```
┌──────────┐
│ USUARIO  │
└────┬─────┘
     │ 1. Selecciona PDF
     ▼
┌─────────────────────────────────────────┐
│  NEXT.JS (Puerto 3000)                  │
│  • Recibe archivo                       │
│  • Valida tipo (PDF)                    │
│  • Genera ID único                      │
└────┬────────────────────────────────────┘
     │ 2. Guarda archivo
     ▼
┌─────────────────────────────────────────┐
│  SISTEMA DE ARCHIVOS LOCAL              │
│  uploads/[document-id]/archivo.pdf      │
└────┬────────────────────────────────────┘
     │ 3. Crea registro
     ▼
┌─────────────────────────────────────────┐
│  POSTGRESQL (Puerto 5432)               │
│  documents:                             │
│  {                                      │
│    id: "abc123",                        │
│    name: "manual.pdf",                  │
│    status: "PENDING",                   │
│    storageUrl: "/api/files/abc123/..."  │
│  }                                      │
│  }                                      │
└────┬────────────────────────────────────┘
     │ 4. Encola trabajo
     ▼
┌─────────────────────────────────────────┐
│  REDIS (Puerto 6379)                    │
│  Cola: document-processing              │
│  [{                                     │
│    documentId: "abc123",                │
│    type: "index"                        │
│  }]                                     │
└────┬────────────────────────────────────┘
     │ 5. Worker toma trabajo
     ▼
┌─────────────────────────────────────────┐
│  WORKER                                 │
│  • Descarga PDF de uploads/             │
│  • Extrae texto con pdf-parse           │
└────┬────────────────────────────────────┘
     │ 6. Analiza con IA
     ▼
┌─────────────────────────────────────────┐
│  NVIDIA NIM (HTTPS)                     │
│  Prompt: "¿Cuál es la estructura        │
│         de este documento?"             │
│                                         │
│  Response: {                            │
│    title: "Manual ISO 9001",            │
│    sections: [                          │
│      {title: "Alcance", page: 1},       │
│      {title: "Referencias", page: 3}    │
│    ]                                    │
│  }                                      │
└────┬────────────────────────────────────┘
     │ 7. Guarda índice
     ▼
┌─────────────────────────────────────────┐
│  POSTGRESQL                             │
│  page_indices:                          │
│  [                                      │
│    {                                    │
│      documentId: "abc123",              │
│      level: 1,                          │
│      title: "Alcance",                  │
│      page: 1                            │
│    },                                   │
│    ...                                  │
│  ]                                      │
└────┬────────────────────────────────────┘
     │ 8. Extrae conocimiento
     ▼
┌─────────────────────────────────────────┐
│  WORKER (Cognee)                        │
│  • Analiza texto con IA                 │
│  • Identifica entidades:                │
│    - "ISO 9001" → NORMA                 │
│    - "Control de documentos" → REQ      │
│  • Identifica relaciones:               │
│    - "ISO 9001" → requiere → "Control"  │
└────┬────────────────────────────────────┘
     │ 9. Guarda grafo
     ▼
┌─────────────────────────────────────────┐
│  FALKORDB (Puerto 6380)                 │
│                                         │
│  CREATE (:NORMA {                      │
│    id: "iso9001",                       │
│    name: "ISO 9001"                     │
│  })                                     │
│                                         │
│  CREATE (:REQUISITO {                   │
│    id: "ctrl-doc",                      │
│    name: "Control de documentos"        │
│  })                                     │
│                                         │
│  MATCH (a:NORMA), (b:REQUISITO)         │
│  CREATE (a)-[:REQUIERE]->(b)            │
└────┬────────────────────────────────────┘
     │ 10. Actualiza estado
     ▼
┌─────────────────────────────────────────┐
│  POSTGRESQL                             │
│  UPDATE documents                       │
│  SET status = 'INDEXED'                 │
│  WHERE id = 'abc123'                    │
└────┬────────────────────────────────────┘
     │ 11. Notifica
     ▼
┌─────────────────────────────────────────┐
│  USUARIO                                │
│  Dashboard muestra:                     │
│  "✓ Documento procesado"                │
│  "45 entidades encontradas"             │
└─────────────────────────────────────────┘
```

---

## Componentes por Capa

### Capa 1: Frontend (Next.js)
```
┌─────────────────────────────────────────┐
│  Componentes React                      │
│  • Dashboard                            │
│  • UploadWizard                         │
│  • DocumentViewer                       │
│  • CertificationList                    │
└─────────────────────────────────────────┘
            │
            │ Server Components
            ▼
┌─────────────────────────────────────────┐
│  API Routes                             │
│  • POST /api/documents                  │
│  • GET /api/documents                   │
│  • GET /api/files/[id]                  │
└─────────────────────────────────────────┘
```

### Capa 2: Procesamiento (Workers)
```
┌─────────────────────────────────────────┐
│  BullMQ Workers                         │
│                                         │
│  Document Worker:                       │
│  ┌─────────────────────────────────┐   │
│  │ 1. downloadFile()               │   │
│  │ 2. extractText()                │   │
│  │ 3. detectStructure()            │   │
│  │ 4. saveIndex()                  │   │
│  └─────────────────────────────────┘   │
│                                         │
│  AI Worker:                             │
│  ┌─────────────────────────────────┐   │
│  │ 1. processDocument()            │   │
│  │ 2. extractEntities()            │   │
│  │ 3. extractRelations()           │   │
│  │ 4. saveToGraph()                │   │
│  └─────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Capa 3: Almacenamiento
```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ PostgreSQL  │  │ FalkorDB    │  │ Redis       │
│             │  │             │  │             │
│ • Users     │  │ • Normas    │  │ • Colas     │
│ • Documents │  │ • Requisitos│  │ • Jobs      │
│ • Indices   │  │ • Empresas  │  │ • Locks     │
│ • Certs     │  │ • Relaciones│  │             │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Capa 4: Servicios Externos
```
┌─────────────────────────────────────────┐
│  NVIDIA NIM API                         │
│                                         │
│  Endpoints:                             │
│  • /v1/embeddings → Vector embeddings   │
│  • /v1/chat/completions → LLM chat      │
│                                         │
│  Modelos:                               │
│  • llama-3_2-nemoretriever-300m         │
│  • meta/llama-3.1-70b-instruct          │
└─────────────────────────────────────────┘
```

---

## Tecnologías por Función

| Función | Tecnología | Alternativa |
|---------|------------|-------------|
| Frontend | Next.js 15 | Vite + React |
| UI Components | shadcn/ui | Material UI |
| ORM | Prisma | Drizzle |
| BD Relacional | PostgreSQL | MySQL |
| BD Grafos | FalkorDB | Neo4j |
| Cache/Colas | Redis | RabbitMQ |
| Workers | BullMQ | Agenda |
| PDF Parsing | pdf-parse | pdfjs-dist |
| IA/LLM | NVIDIA NIM | OpenAI API |
| Auth | NextAuth | Auth0 |
| Storage | Local FS | AWS S3 |

---

## Decisiones de Arquitectura

### ¿Por qué Workers Separados?
- **Procesamiento pesado** no bloquea la UI
- **Escalabilidad**: más workers = más throughput
- **Reintentos**: trabajos fallidos se reintentan automáticamente
- **Prioridades**: colas separadas para diferentes tipos de trabajo

### ¿Por qué FalkorDB?
- **Nativo en Redis**: mismo protocolo, fácil integración
- **Cypher**: lenguaje de consulta estándar
- **Performance**: grafos en memoria
- **Open Source**: sin costos de licencia

### ¿Por qué Almacenamiento Local?
- **Desarrollo**: más simple, sin configuración cloud
- **Testing**: no hay costos por API calls
- **Producción**: fácil migrar a GCS/S3

### ¿Por qué NVIDIA NIM?
- **Modelos abiertos**: Llama, Mistral, etc.
- **Precio**: más económico que OpenAI
- **Privacidad**: datos no entrenan modelos
- **Performance**: GPUs optimizadas

---

**Documento técnico para el equipo de desarrollo**  
Última actualización: Marzo 2026
