# 🧠 Guía de Uso: PageIndex + Cognee + FalkorDB

## 📋 ¿Qué Hace Cada Componente?

### PageIndex → "El Bibliotecario"
**Función:** Analiza la estructura de documentos PDF

```
┌─────────────────────────────────────────┐
│  DOCUMENTO PDF (100 páginas)            │
│                                         │
│  Capítulo 1: Introducción ....... 1     │
│  Capítulo 2: Alcance ............ 5     │
│    2.1 Objetivo General ........ 6      │
│    2.2 Objetivos Específicos ... 8      │
│  Capítulo 3: Referencias ....... 15     │
└─────────────────────────────────────────┘
              ↓ PageIndex analiza
┌─────────────────────────────────────────┐
│  ÍNDICE JERÁRQUICO                      │
│                                         │
│  📄 Documento                           │
│  └─ 📁 Capítulo 1 (página 1)            │
│  └─ 📁 Capítulo 2 (página 5)            │
│     └─ 📄 2.1 Objetivo General (pág 6)  │
│     └─ 📄 2.2 Objetivos Específicos     │
│  └─ 📁 Capítulo 3 (página 15)           │
└─────────────────────────────────────────┘
```

**¿Para qué sirve?**
- Buscar contenido específico en documentos largos
- Navegar por secciones sin leer todo el documento
- Entender la estructura del documento rápidamente

---

### Cognee → "El Analista"
**Función:** Extrae conocimiento del texto

```
┌─────────────────────────────────────────┐
│  TEXTO DEL DOCUMENTO                    │
│                                         │
│  "La empresa ACME S.A. debe cumplir     │
│   con la norma ISO 9001:2015,           │
│   específicamente en el requisito       │
│   4.2 de Control de Documentos."        │
└─────────────────────────────────────────┘
              ↓ Cognee analiza con IA
┌─────────────────────────────────────────┐
│  ENTIDADES EXTRAÍDAS                    │
│                                         │
│  🏢 ORGANIZATION: ACME S.A.             │
│  📋 REGULATION: ISO 9001:2015           │
│  📝 REQUIREMENT: Control de Documentos  │
│  🔢 SECTION: 4.2                        │
└─────────────────────────────────────────┘
```

**¿Para qué sirve?**
- Identificar automáticamente normas aplicables
- Extraer requisitos de cumplimiento
- Conectar conceptos relacionados

---

### FalkorDB → "El Cerebro"
**Función:** Almacena conocimiento en grafos

```
┌─────────────────────────────────────────┐
│  GRAFO DE CONOCIMIENTO                  │
│                                         │
│     [ACME S.A.]                         │
│          │                              │
│          │ COMPLIES_WITH                │
│          ↓                              │
│     [ISO 9001:2015]                     │
│          │                              │
│          │ REQUIRES                     │
│          ↓                              │
│     [Control de Documentos]             │
│          │                              │
│          │ LOCATED_IN                   │
│          ↓                              │
│     [Sección 4.2]                       │
└─────────────────────────────────────────┘
```

**¿Para qué sirve?**
- Consultar: "¿Qué normas debe cumplir ACME?"
- Consultar: "¿Qué requisitos tiene ISO 9001?"
- Consultar: "¿Dónde está el requisito X?"

---

## 🔄 Flujo Completo de Procesamiento

### Paso a Paso

```
1. USUARIO sube "manual-iso-9001.pdf"
   ↓
2. SISTEMA guarda archivo en uploads/
   ↓
3. WORKER toma el trabajo de la cola
   ↓
4. PAGEINDEX extrae texto del PDF
   ↓
5. PAGEINDEX pregunta a IA: "¿Cuál es la estructura?"
   ↓
6. IA responde: {
     title: "Manual ISO 9001",
     sections: [
       {title: "Objetivo", page: 1},
       {title: "Alcance", page: 3},
       ...
     ]
   }
   ↓
7. PAGEINDEX guarda índice en PostgreSQL
   ↓
8. COGNEE analiza el texto completo
   ↓
9. COGNEE extrae entidades:
   - "ISO 9001" → tipo: REGULATION
   - "Control de Documentos" → tipo: REQUIREMENT
   ↓
10. COGNEE guarda en FalkorDB:
    CREATE (:REGULATION {name: "ISO 9001"})
    CREATE (:REQUIREMENT {name: "Control de Documentos"})
    MATCH (r:REGULATION), (req:REQUIREMENT)
    CREATE (r)-[:REQUIRES]->(req)
    ↓
11. SISTEMA actualiza estado: "INDEXED ✓"
    ↓
12. USUARIO ve resultados en dashboard
```

---

## 💻 Cómo Usar en la Práctica

### 1. Subir un Documento

```bash
# Ir al dashboard
http://localhost:3000/dashboard

# Click en "Subir Documento"
# Arrastrar PDF
# Esperar procesamiento (30-60 segundos)
```

### 2. Ver Resultado de PageIndex

Después de procesar, el documento tendrá:
- **Secciones identificadas** (ej: 45 secciones)
- **Páginas de cada sección**
- **Jerarquía** (capítulos → subsecciones)

**Ejemplo de consulta:**
```
Usuario: "¿Dónde habla de control de documentos?"

PageIndex busca en el índice y responde:
"Sección 4.2 - Control de Documentos, página 15"
```

### 3. Ver Resultado de Cognee + FalkorDB

Cognee extrajo entidades como:

```
📋 NORMAS:
- ISO 9001:2015
- ISO 14001:2015
- Ley 29783 (Seguridad Laboral)

📝 REQUISITOS:
- Control de Documentos
- Auditorías Internas
- Acciones Correctivas

🏢 EMPRESAS:
- ACME S.A.
- Certificación XYZ Ltd.
```

**Ejemplo de consultas en FalkorDB:**

```cypher
// ¿Qué normas están en el sistema?
MATCH (n:REGULATION) RETURN n.name

// ¿Qué requisitos tiene ISO 9001?
MATCH (iso:REGULATION {name: "ISO 9001:2015"})-[:REQUIRES]->(req)
RETURN req.name

// ¿Qué empresas cumplen ISO 9001?
MATCH (emp:ORGANIZATION)-[:COMPLIES_WITH]->(iso:REGULATION {name: "ISO 9001:2015"})
RETURN emp.name
```

---

## 🎯 Casos de Uso Reales

### Caso 1: Auditoría de Cumplimiento

**Situación:** Necesitas verificar qué documentos cumplen con ISO 9001

**Proceso:**
1. Subes todos los manuales de la empresa
2. Cognee extrae todas las referencias a "ISO 9001"
3. FalkorDB conecta documentos con la norma
4. Consultas en FalkorDB:

```cypher
MATCH (doc:DOCUMENT)-[:REFERENCES]->(iso:REGULATION {name: "ISO 9001:2015"})
RETURN doc.name, doc.uploadDate
```

**Resultado:** Lista de documentos relevantes para la auditoría

---

### Caso 2: Búsqueda de Requisitos Específicos

**Situación:** Buscas todos los requisitos relacionados con "auditorías"

**Proceso:**
1. PageIndex indexó todos los documentos
2. Cognee extrajo requisitos con esa palabra
3. Consultas:

```cypher
MATCH (req:REQUIREMENT)
WHERE req.name CONTAINS "auditoría" OR req.name CONTAINS "audit"
RETURN req.name, req.section
```

**Resultado:** Lista de requisitos de auditoría con su ubicación

---

### Caso 3: Análisis de Brechas (Gap Analysis)

**Situación:** Quieres saber qué requisitos de ISO 9001 NO están implementados

**Proceso:**
1. FalkorDB tiene todos los requisitos de ISO 9001
2. FalkorDB tiene los requisitos implementados por la empresa
3. Consultas brechas:

```cypher
// Requisitos de ISO 9001
MATCH (iso:REGULATION {name: "ISO 9001:2015"})-[:REQUIRES]->(req)
WITH collect(req.name) AS required

// Requisitos implementados
MATCH (emp:ORGANIZATION {name: "ACME"})-[:IMPLEMENTS]->(impl)
WITH required, collect(impl.name) AS implemented

// Brechas
UNWIND required AS req
WHERE NOT req IN implemented
RETURN req AS "Requisitos Faltantes"
```

**Resultado:** Lista de requisitos faltantes

---

## 🛠️ Comandos y Consultas Útiles

### Verificar que PageIndex Funciona

```bash
# En la terminal de Next.js, busca:
[PageIndex] Indexando documento: abc123
[PageIndex] Índice creado con 45 nodos
```

### Verificar que Cognee Funciona

```bash
# Busca en logs:
[Cognee] Analizando documento: abc123
Persistiendo 23 entidades en FalkorDB
Persistiendo 15 relaciones en FalkorDB
```

### Consultar FalkorDB Directamente

```bash
# Conectar a Redis/FalkorDB
docker exec -it falkordb-dev redis-cli

# Ejecutar consulta Cypher
GRAPH.QUERY certificacion "MATCH (n) RETURN n.name, labels(n) LIMIT 10"
```

### Ver Estado de Documentos

```sql
-- En Prisma Studio (npm run db:studio)
-- Ver tabla "Document"
SELECT name, status, "createdAt"
FROM "Document"
ORDER BY "createdAt" DESC;
```

---

## 📊 Métricas de Procesamiento

### Tiempos Promedio

| Tamaño PDF | Páginas | Tiempo PageIndex | Tiempo Cognee | Total |
|------------|---------|------------------|---------------|-------|
| Pequeño (< 5MB) | 10-20 | 15-20 seg | 10-15 seg | 30-40 seg |
| Mediano (5-20MB) | 20-100 | 30-60 seg | 20-40 seg | 1-2 min |
| Grande (> 20MB) | 100+ | 1-2 min | 1-2 min | 2-4 min |

### Entidades Extraídas Típicamente

| Tipo de Documento | Entidades Promedio |
|-------------------|-------------------|
| Norma ISO | 50-100 entidades |
| Manual de Procedimientos | 30-60 entidades |
| Política Corporativa | 20-40 entidades |
| Contrato | 40-80 entidades |

---

## 🐛 Troubleshooting

### PageIndex No Detecta Estructura

**Síntoma:** Solo crea nodos por página, no por secciones

**Causa:** La IA no pudo identificar la tabla de contenido

**Solución:**
1. Verificar que el PDF tenga texto (no sea escaneado)
2. Revisar logs de NVIDIA NIM
3. Verificar API key: `echo $NVIDIA_API_KEY`

### Cognee No Extrae Entidades

**Síntoma:** 0 entidades en FalkorDB

**Causa:** FalkorDB no está conectado

**Solución:**
```bash
# Verificar FalkorDB
docker ps | grep falkor

# Ver logs
docker logs falkordb-dev

# Reiniciar
docker restart falkordb-dev
```

### FalkorDB No Guarda Datos

**Síntoma:** Entidades se extraen pero no persisten

**Causa:** Error de conexión o grafo no existe

**Solución:**
```bash
# Conectar y verificar
docker exec -it falkordb-dev redis-cli

# Listar grafos
GRAPH.LIST

# Si no existe "certificacion", se crea automáticamente
# al guardar la primera entidad
```

---

## 📚 Ejemplos de Código

### Usar PageIndex Programáticamente

```typescript
import { pageIndexService } from "@/lib/pageindex";

// Leer PDF
const pdfBuffer = fs.readFileSync("manual.pdf");

// Construir índice
const index = await pageIndexService.buildIndex(
  "doc-123",
  pdfBuffer,
  "manual-iso-9001.pdf"
);

// Consultar
const results = await pageIndexService.query(index, "control de documentos");
console.log(results.context);
```

### Usar Cognee Programáticamente

```typescript
import { cogneeService } from "@/lib/cognee";

// Inicializar FalkorDB
await cogneeService.initialize();

// Procesar documento
const knowledgeGraph = await cogneeService.processDocument(
  textoDelDocumento,
  "Norma ISO"
);

// Guardar en FalkorDB
await cogneeService.addEntities(knowledgeGraph.entities);
await cogneeService.addRelations(knowledgeGraph.relations);

// Consultar
const result = await cogneeService.query("¿Qué normas aplican?");
console.log(result.answer);
```

---

**Última actualización:** Marzo 2026  
**Versión:** 1.0.0
