# 📚 Documentación Completa - Sistema de Certificación con IA

> **Versión:** 2.0.0  
> **Última actualización:** Marzo 2026  
> **Autor:** Equipo de Desarrollo

---

## 🚀 Inicio Rápido

### 1. Iniciar el Sistema

```bash
cd /home/alex/cetiem/certificacion-ia
./start.sh
```

**Esto inicia automáticamente:**
- ✅ FalkorDB (grafo de conocimiento) - Puerto 6380
- ✅ Redis (colas de trabajo) - Puerto 6379
- ✅ Next.js (servidor web) - Puerto 3000
- ✅ Workers (procesamiento IA) - Background
- ✅ PostgreSQL (base de datos) - Puerto 5432

### 2. Acceder a la Aplicación

| Servicio | URL | Propósito |
|----------|-----|-----------|
| **App Principal** | http://localhost:3000 | Landing page |
| **Dashboard** | http://localhost:3000/dashboard | Panel principal |
| **Subir PDF** | http://localhost:3000/dashboard/upload | Cargar documentos |
| **FalkorDB UI** | http://localhost:3001 | Ver grafos |

### 3. Login

```
Email: admin@local.dev
Password: admin123
```

---

## 📖 Flujo de Trabajo Completo

### Paso 1: Subir Documento PDF

1. Ve a http://localhost:3000/dashboard/upload
2. Arrastra un archivo PDF o haz clic para seleccionar
3. (Opcional) Agrega una descripción
4. Click en "Subir Documento"

**Lo que sucede:**
```
PDF → Almacenamiento local (uploads/)
    → PostgreSQL (registro del documento)
    → Cola de trabajo (BullMQ)
    → Workers procesan en background
```

### Paso 2: Procesamiento Automático

**PageIndex extrae:**
- ✅ Texto completo del PDF
- ✅ Estructura jerárquica (capítulos, secciones)
- ✅ Índice de páginas

**Cognee extrae:**
- ✅ Entidades (empresas, conceptos, lugares)
- ✅ Relaciones entre entidades
- ✅ Guarda en FalkorDB con `documentId`

### Paso 3: Ver Resultados

**En el Dashboard:**
- Estado: "✓ Listo" cuando termina
- Click en 📄 para ver detalles

**Página de Detalles:**
- Información del documento
- Índice extraído (PageIndex)
- Botón "Ver Contenido Extraído"
- Botón "Grafo de Conocimiento"

---

## 🔍 Ver Contenido Extraído

### Opción 1: Texto Completo

**URL:** `/dashboard/documents/[ID]/content`

**Muestra:**
- 📄 Lista de secciones con su contenido
- 👁️ Vista "Ver Todo" (texto completo)
- 💾 Botón descargar como .txt
- 📊 Estadísticas (caracteres, secciones, páginas)

### Opción 2: Grafo de Conocimiento

**URL:** `/dashboard/documents/[ID]/graph`

**Muestra:**
- 🕸️ Entidades extraídas por Cognee
- 🔗 Relaciones entre entidades
- 📊 Estadísticas del grafo

### Opción 3: Consultar Grafo Global

**URL:** `/dashboard/graph`

**Permite:**
- Ejecutar consultas Cypher personalizadas
- Ver entidades de TODOS los documentos
- Encontrar conexiones cruzadas

---

## 🛠️ Comandos Útiles

### Sistema

```bash
# Iniciar todo
./start.sh

# Detener todo
./stop.sh

# Reiniciar workers
./restart-workers.sh

# Ver logs de workers
tail -f /tmp/workers.log

# Verificar servicios
docker ps | grep -E "falkor|redis"
```

### FalkorDB (Terminal)

```bash
# Conectar a FalkorDB
docker exec -it falkordb-dev redis-cli

# Ver TODAS las entidades
GRAPH.QUERY certificacion "MATCH (n) RETURN labels(n)[0] AS tipo, n.name AS nombre"

# Ver TODAS las relaciones
GRAPH.QUERY certificacion "MATCH (a)-[r]->(b) RETURN a.name, type(r), b.name"

# Entidades de un documento específico
GRAPH.QUERY certificacion "MATCH (n {documentId: 'TU_ID'}) RETURN n.name"

# Contar entidades por documento
GRAPH.QUERY certificacion "MATCH (n) WHERE n.documentId IS NOT NULL RETURN n.documentId, count(n)"

# Eliminar entidades de un documento
GRAPH.QUERY certificacion "MATCH (n {documentId: 'TU_ID'}) DETACH DELETE n"

# Eliminar TODO el grafo
GRAPH.DELETE certificacion

# Salir
exit
```

### PostgreSQL (Terminal)

```bash
# Conectar a PostgreSQL
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db

# Ver documentos
SELECT id, name, status, "createdAt" FROM "certificacion_ia"."Document" ORDER BY "createdAt" DESC;

# Ver índices de un documento
SELECT level, title, page FROM "certificacion_ia"."PageIndex" WHERE "documentId" = 'TU_ID' ORDER BY level;

# Contar documentos por estado
SELECT status, count(*) FROM "certificacion_ia"."Document" GROUP BY status;

# Eliminar documento y sus índices
DELETE FROM "certificacion_ia"."PageIndex" WHERE "documentId" = 'TU_ID';
DELETE FROM "certificacion_ia"."Document" WHERE id = 'TU_ID';

# Salir
\q
```

### Redis (Terminal)

```bash
# Conectar a Redis
docker exec -it redis-dev redis-cli

# Ver colas de trabajo
KEYS *

# Ver trabajos pendientes
LLEN document-processing
LLEN ai-analysis

# Ver trabajos encolados
LRANGE document-processing 0 -1

# Limpiar cola
DEL document-processing

# Salir
exit
```

---

## 📊 API Endpoints

### Documentos

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/api/documents` | Listar documentos del usuario |
| POST | `/api/documents` | Subir nuevo documento |
| DELETE | `/api/documents/[id]` | Eliminar documento |
| PATCH | `/api/documents/[id]` | Actualizar documento |

### Contenido

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/api/documents/[id]/content` | Obtener texto extraído |

### Grafo

| Método | Endpoint | Propósito |
|--------|----------|-----------|
| GET | `/api/graph/stats` | Estadísticas del grafo |
| POST | `/api/graph/query` | Ejecutar consulta Cypher |

### Ejemplo: Consultar Grafo

```bash
curl -X POST http://localhost:3000/api/graph/query \
  -H "Content-Type: application/json" \
  -d '{"query": "MATCH (n:ORGANIZATION) RETURN n.name"}'
```

---

## 🧠 Cómo Funciona Cognee + FalkorDB

### Arquitectura

```
┌─────────────────────────────────────────────────────────┐
│                    TU DOCUMENTO PDF                      │
└─────────────────────────────────────────────────────────┘
                            │
            ┌───────────────┴───────────────┐
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│   PageIndex (Texto)   │       │   Cognee (Grafo)      │
│                       │       │                       │
│  - Secciones          │       │  - Entidades          │
│  - Páginas            │       │  - Relaciones         │
│  - Contenido          │       │  - documentId         │
│                       │       │                       │
│  PostgreSQL           │       │  FalkorDB             │
└───────────────────────┘       └───────────────────────┘
```

### Entidades que Extrae Cognee

| Tipo | Ejemplos |
|------|----------|
| **ORGANIZATION** | Empresas, instituciones, universidades |
| **CONCEPT** | Teorías, metodologías, ideas |
| **LOCATION** | Países, ciudades, regiones |
| **DATE** | Fechas, años, períodos |
| **PERSON** | Personas, autores |
| **TECHNOLOGY** | Herramientas, frameworks, software |
| **REGULATION** | Normas, leyes, estándares |
| **REQUIREMENT** | Requisitos, obligaciones |

### Relaciones que Crea

| Tipo | Significado |
|------|-------------|
| **COMPETES_WITH** | Compite con |
| **OPERATES_IN** | Opera en |
| **OFFERS** | Ofrece |
| **LOCATED_IN** | Ubicado en |
| **RELATED_TO** | Relacionado con |
| **PART_OF** | Parte de |
| **REFERENCES** | Referencia a |

---

## 🔎 Consultas Cypher de Ejemplo

### Básicas

```cypher
# Todas las entidades
MATCH (n) RETURN n.name, labels(n)[0] AS tipo

# Solo organizaciones
MATCH (n:ORGANIZATION) RETURN n.name

# Solo conceptos
MATCH (n:CONCEPT) RETURN n.name

# Entidades de un documento
MATCH (n {documentId: 'xxx'}) RETURN n.name
```

### Avanzadas

```cypher
# Entidades compartidas entre documentos
MATCH (n) WHERE n.documentId IS NOT NULL
RETURN n.name, collect(DISTINCT n.documentId) AS documentos
HAVING size(collect(DISTINCT n.documentId)) > 1

# Relaciones de una entidad
MATCH (n {name: 'DriveApp MX'})-[r]->(b)
RETURN type(r), b.name

# Camino más corto entre dos entidades
MATCH path = shortestPath((a {name: 'DriveApp MX'})-[*]-(b {name: 'México'}))
RETURN path

# Contar por tipo
MATCH (n) RETURN labels(n)[0] AS tipo, count(n) AS cantidad
```

---

## 🧹 Limpieza y Mantenimiento

### Eliminar Documento Completo

**Desde la UI:**
1. Dashboard → Click en 🗑️ del documento
2. Confirmar eliminación

**Desde Terminal:**
```bash
# PostgreSQL
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "DELETE FROM \"certificacion_ia\".\"PageIndex\" WHERE \"documentId\" = 'TU_ID';"
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "DELETE FROM \"certificacion_ia\".\"Document\" WHERE id = 'TU_ID';"

# FalkorDB
docker exec -it falkordb-dev redis-cli
GRAPH.QUERY certificacion "MATCH (n {documentId: 'TU_ID'}) DETACH DELETE n"

# Archivos
rm -rf /home/alex/cetiem/certificacion-ia/uploads/TU_ID/
```

### Reiniciar Sistema Completo

```bash
# Detener
./stop.sh

# Esperar 5 segundos
sleep 5

# Iniciar
./start.sh
```

### Verificar Estado

```bash
# Servicios Docker
docker ps | grep -E "falkor|redis|postgres"

# Workers corriendo
ps aux | grep workers | grep -v grep

# Puerto 3000 disponible
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000

# Debe devolver: 200
```

---

## 🐛 Troubleshooting

### Error: "Metadatos no encontrados"

**Causa:** El archivo no se guardó correctamente

**Solución:**
```bash
# Verificar archivos en uploads
ls -la /home/alex/cetiem/certificacion-ia/uploads/[DOCUMENT_ID]/

# Debe existir:
# - [ID].pdf
# - metadata.json

# Si falta, volver a subir el documento
```

### Error: "DOMMatrix is not defined"

**Causa:** pdfjs-dist necesita polyfill

**Solución:** Ya está corregido en el código. Reiniciar workers:
```bash
./restart-workers.sh
```

### Error: "ENOENT: no such file or directory"

**Causa:** El worker busca el PDF en ruta incorrecta

**Solución:** El archivo debe llamarse `[ID].pdf`:
```bash
# Verificar nombre del archivo
ls uploads/[ID]/

# Si el nombre es diferente, corregir en queue/index.ts
```

### Workers No Procesan

**Síntoma:** Documentos se quedan en "Pendiente"

**Solución:**
```bash
# Verificar Redis
docker exec redis-dev redis-cli PING
# Debe responder: PONG

# Reiniciar workers
./restart-workers.sh

# Ver logs
tail -f /tmp/workers.log
```

### FalkorDB No Responde

**Solución:**
```bash
# Verificar contenedor
docker ps | grep falkor

# Reiniciar FalkorDB
docker restart falkordb-dev

# Ver logs
docker logs falkordb-dev
```

---

## 📈 Métricas y Estadísticas

### Ver en Terminal

```bash
# Documentos totales
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -t -c \
  "SELECT count(*) FROM \"certificacion_ia\".\"Document\";"

# Entidades en FalkorDB
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion "MATCH (n) RETURN count(n)"

# Relaciones en FalkorDB
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion "MATCH ()-[r]->() RETURN count(r)"
```

### Ver en UI

**Dashboard:**
- Total documentos
- Documentos procesados
- Entidades extraídas
- Relaciones creadas

**Página del Grafo:**
- http://localhost:3000/dashboard/graph
- Click en "Actualizar"

---

## 🔐 Seguridad

### Credenciales por Defecto

| Servicio | Usuario | Password |
|----------|---------|----------|
| **App** | admin@local.dev | admin123 |
| **PostgreSQL** | postgres | password |
| **FalkorDB** | - | - (sin auth) |

### Cambiar Password

**PostgreSQL:**
```bash
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "ALTER USER postgres WITH PASSWORD 'nuevo_password';"
```

**App:**
Editar `.env`:
```
NEXTAUTH_SECRET=tu_nuevo_secreto_seguro
```

---

## 📞 Soporte

### Logs

```bash
# Workers
tail -f /tmp/workers.log

# Next.js
# Ver en la terminal donde corre start.sh

# FalkorDB
docker logs falkordb-dev

# Redis
docker logs redis-dev

# PostgreSQL
docker logs cipre-security-project-db-1
```

### Archivos Importantes

```
certificacion-ia/
├── src/lib/
│   ├── queue/index.ts      # Workers de procesamiento
│   ├── cognee.ts           # Extracción de entidades
│   ├── pageindex-real.ts   # Extracción de texto
│   └── storage.ts          # Almacenamiento local
├── src/app/
│   ├── dashboard/          # Páginas de la UI
│   └── api/                # Endpoints API
├── .env                    # Variables de entorno
└── uploads/                # Documentos subidos
```

---

## ✅ Checklist de Uso Diario

### Al Empezar el Día

- [ ] `./start.sh` - Iniciar sistema
- [ ] Verificar http://localhost:3000 - App funcionando
- [ ] `tail -f /tmp/workers.log` - Workers activos

### Al Subir Documento

- [ ] Ir a `/dashboard/upload`
- [ ] Subir PDF
- [ ] Esperar 30-60 segundos
- [ ] Verificar estado "✓ Listo"
- [ ] Click en 📄 para ver detalles
- [ ] Revisar contenido extraído
- [ ] Revisar grafo de conocimiento

### Al Terminar el Día

- [ ] `./stop.sh` - Detener sistema (opcional)
- [ ] O dejar corriendo si se usa mañana

---

## 🎯 Próximos Pasos Sugeridos

1. **Chatbot con Contexto del Grafo**
   - Integrar LLM que consulte FalkorDB
   - Responder preguntas sobre documentos

2. **Exportar Reportes**
   - PDF con texto extraído
   - CSV con entidades
   - GraphML con grafo

3. **Búsqueda Semántica**
   - Buscar por significado, no por palabras
   - Usar embeddings de NVIDIA NIM

4. **Multi-Usuario**
   - Roles y permisos
   - Documentos privados/públicos

---

**¡Sistema listo para producción!** 🚀
