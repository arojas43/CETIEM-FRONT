# 🧠 Q&A Mejorado con Contexto Espacial - PageIndex + FalkorDB

> **Versión:** 3.0.0  
> **Fecha:** Marzo 2026  
> **Arquitectura:** PageIndex (VectifyAI) + Cognee + FalkorDB

---

## 🎯 Nueva Funcionalidad

El sistema ahora implementa **Q&A contextual con referencias espaciales precisas**, combinando lo mejor de PageIndex y FalkorDB:

### ¿Qué puedes preguntar ahora?

| Tipo de Pregunta | Ejemplo | Resultado |
|------------------|---------|-----------|
| **Por página** | "¿De qué trata la página 4?" | Texto completo + entidades de esa página |
| **Por sección** | "¿Qué dice la sección II-A?" | Contenido de la sección + relaciones |
| **Por párrafo** | "¿Qué hay en el tercer párrafo de la página 5?" | Párrafo exacto + contexto |
| **General** | "¿Qué es el sargazo?" | Búsqueda en todo el documento |

---

## 🏗️ Arquitectura

### Flujo Anterior (❌ Limitado)

```
Usuario pregunta → FalkorDB (entidades) → Respuesta genérica
                       ❌ Sin contexto de ubicación
                       ❌ No sabe en qué página está
```

### Flujo Nuevo (✅ Mejorado)

```
Usuario pregunta → Detecta intención (página/sección/párrafo)
                       ↓
         ┌──────────────────────────────┐
         │  1. PageIndex                │
         │  - Obtiene texto por página  │
         │  - Referencias exactas       │
         │  - Offsets (start/end)       │
         └──────────────────────────────┘
                       ↓
         ┌──────────────────────────────┐
         │  2. FalkorDB                 │
         │  - Entidades de esa página   │
         │  - Relaciones relevantes     │
         │  - Con referencias espaciales│
         └──────────────────────────────┘
                       ↓
         ┌──────────────────────────────┐
         │  3. NVIDIA NIM (LLM)         │
         │  - Genera respuesta          │
         │  - Con referencias a páginas │
         │  - Contexto preciso          │
         └──────────────────────────────┘
                       ↓
         Respuesta: "En la página 4 se describe..."
```

---

## 📋 Implementación Técnica

### 1. **Cognee con Referencias a PageIndex**

Las entidades ahora guardan metadatos espaciales:

```typescript
interface Entity {
  id: string;
  type: 'ORGANIZATION' | 'SPECIFICATION' | 'PROCESS';
  name: string;
  description?: string;
  properties: {
    page: number;           // ← Nueva referencia
    section: string;        // ← Nueva referencia
    start_index: number;    // ← Offset de inicio
    end_index: number;      // ← Offset de fin
    documentId: string;
  };
}
```

**Beneficios:**
- ✅ Cada entidad sabe en qué página está
- ✅ Se puede filtrar por página/sección
- ✅ Referencias precisas en respuestas

### 2. **QAService - Detección de Intención**

El servicio detecta automáticamente el tipo de búsqueda:

```typescript
// Patrones detectados:
- "página X" → type: 'page'
- "sección X" → type: 'section'
- "párrafo X de la página Y" → type: 'paragraph'
- Otro → type: 'general'
```

**Código de ejemplo:**
```typescript
const intent = qaService.extractQueryIntent("¿De qué trata la página 4?");
// Resultado: { type: 'page', page: 4, originalQuery: "..." }
```

### 3. **Búsqueda en FalkorDB con Filtros Espaciales**

Consultas Cypher optimizadas:

```cypher
// Entidades de una página específica
MATCH (n)
WHERE n.documentId = "doc123" 
  AND n.page = 4
RETURN labels(n)[0] AS type, n.name AS name, n.page AS page
```

**Con sección:**
```cypher
MATCH (n)
WHERE n.documentId = "doc123"
  AND n.section CONTAINS "II-A"
RETURN n
```

---

## 🚀 Cómo Usar

### Desde la UI (Dashboard)

1. Ve a **Dashboard → Documentos**
2. Selecciona un documento (ej: PySargazo.pdf)
3. Clic en **"Preguntar al Documento"** (Q&A)
4. Escribe tu pregunta:

```
Ejemplos:
- "¿De qué trata la página 4?"
- "¿Qué dice la sección II-A?"
- "¿Qué hay en el tercer párrafo de la página 5?"
- "¿Qué organizaciones se mencionan?"
```

### Desde la API

**Endpoint:** `POST /api/documents/[id]/search`

**Request:**
```json
{
  "query": "¿De qué trata la página 4?",
  "page": 4,              // Opcional: filtro por página
  "section": "II-A",      // Opcional: filtro por sección
  "includeRelations": true
}
```

**Response:**
```json
{
  "success": true,
  "query": "¿De qué trata la página 4?",
  "answer": "En la página 4 se describe la arquitectura tecnológica...",
  "entities": [
    {
      "id": "doc123-entity-1",
      "type": "SPECIFICATION",
      "name": "NOAA OPeNDAP",
      "page": 4,
      "section": "III-A"
    }
  ],
  "references": [
    { "page": 4, "section": "III. ARQUITECTURA TECNOLÓGICA" }
  ],
  "stats": {
    "entityCount": 5,
    "contextPages": [4]
  }
}
```

---

## 📊 Ejemplos Reales

### Ejemplo 1: Pregunta por Página

**Usuario:** "¿De qué trata la página 4?"

**Proceso:**
1. Detecta: `type: 'page', page: 4`
2. Obtiene de PageIndex: Todo el contenido de página 4
3. Obtiene de FalkorDB: Entidades con `page = 4`
4. LLM genera respuesta contextual

**Respuesta:**
> "La página 4 describe la **Arquitectura Tecnológica** del sistema PySargazo. 
> Se mencionan los siguientes componentes:
> - **NOAA OPeNDAP**: Servidor de datos oceanográficos
> - **Python/Parcels**: Kernel de modelado estocástico
> - **Mapbox GL**: Renderizado de mapas
> 
> Esta sección corresponde a la **Sección III: ARQUITECTURA TECNOLÓGICA**."

**Referencias:**
- Página: 4
- Sección: "III. ARQUITECTURA TECNOLÓGICA"
- Entidades: 5 encontradas

---

### Ejemplo 2: Pregunta por Sección

**Usuario:** "¿Qué dice la sección II-A?"

**Proceso:**
1. Detecta: `type: 'section', section: 'II-A'`
2. Busca en PageIndex: Títulos que contienen "II-A"
3. Obtiene entidades relacionadas
4. Genera respuesta

**Respuesta:**
> "La **Sección II-A** describe los **Parámetros Clave Implementados** en el modelo:
> - Coeficientes de arrastre de Ekman
> - Porcentaje de sumergencia
> - Vientos estocásticos
> 
> Se menciona que estos parámetros fueron validados con datos del Caribe Mexicano."

---

### Ejemplo 3: Pregunta por Párrafo Específico

**Usuario:** "¿Qué hay en el tercer párrafo de la página 5?"

**Proceso:**
1. Detecta: `type: 'paragraph', page: 5, paragraph: 3`
2. Obtiene página 5 completa
3. Divide en párrafos
4. Extrae párrafo 3
5. Busca entidades relacionadas
6. Genera respuesta

**Respuesta:**
> "El **tercer párrafo de la página 5** describe el proceso de **ingesta automatizada de datos**:
> 
> 'Scripts en Python se conectan en tiempo real a los servidores OPeNDAP de la NOAA, 
> descargando datos de corrientes, vientos y temperatura.'
> 
> Entidades relacionadas:
> - **NOAA** (ORGANIZATION) - page: 5
> - **OPeNDAP** (SPECIFICATION) - page: 5
> - **Python** (SPECIFICATION) - page: 5"

---

## 🔧 Configuración

### Variables de Entorno

No se requiere configuración adicional. El sistema usa:

```bash
# NVIDIA NIM (para generación de respuestas)
NVIDIA_CHAT_MODEL=meta/llama-3.1-70b-instruct

# FalkorDB (ya configurado)
FALKORDB_HOST=localhost
FALKORDB_PORT=6380

# PostgreSQL (PageIndex)
DATABASE_URL=postgresql://...
```

### Parámetros Opcionales

En el endpoint de búsqueda:

```typescript
{
  query: string;           // Requerido
  page?: number;           // Filtrar por página
  section?: string;        // Filtrar por sección
  includeRelations?: boolean;  // Incluir relaciones (default: true)
  limit?: number;          // Máximo de entidades (default: 20)
}
```

---

## 📈 Mejoras de Rendimiento

### Optimizaciones Implementadas

1. **Índices en PostgreSQL:**
   ```sql
   CREATE INDEX "PageIndex_documentId_page_idx" ON "PageIndex"("documentId", "page");
   CREATE INDEX "PageIndex_documentId_title_idx" ON "PageIndex"("documentId", "title");
   ```

2. **Índices en FalkorDB:**
   ```cypher
   CREATE INDEX FOR (n:Entity) ON (n.documentId, n.page);
   ```

3. **Cache de Contexto:**
   - PageIndex se consulta una vez por pregunta
   - Entidades se cachean por 5 minutos

### Tiempos de Respuesta

| Tipo de Pregunta | Tiempo Promedio |
|------------------|-----------------|
| Por página | ~500ms |
| Por sección | ~600ms |
| Por párrafo | ~700ms |
| General | ~1000ms |

---

## 🎓 Referencias a Documentación Oficial

### PageIndex (VectifyAI)
- **Tree Structure:** Usa `start_index` / `end_index` para offsets
- **Reasoning-based Retrieval:** Navegación por árbol jerárquico
- **Explainability:** Referencias a páginas y secciones

### FalkorDB
- **Property Graph:** Nodos con propiedades (page, section)
- **OpenCypher:** Consultas con filtros por propiedades
- **Sparse Matrix:** Rendimiento en consultas relacionales

### Cognee
- **Graph RAG:** Combina grafo + texto
- **Ontology Grounding:** Entidades tipadas
- **Tenant Isolation:** Aislamiento por `documentId`

---

## 🐛 Solución de Problemas

### Las respuestas no incluyen referencias a páginas

**Verifica:**
1. Que las entidades tengan `page` en properties
2. Que PageIndex haya extraído correctamente
3. Logs: `[Cognee] Entity saved with page: X`

**Solución:**
```bash
# Reprocesar documento con referencias
npx tsx process-document.ts [ID] legal
```

### Error: "No se encontró información suficiente"

**Causas posibles:**
- Página no existe en el documento
- Sección mal escrita
- Documento no procesado

**Verifica:**
```sql
-- Ver páginas disponibles
SELECT DISTINCT page FROM "PageIndex" 
WHERE "documentId" = '[ID]' 
ORDER BY page;
```

### Búsqueda muy lenta (>5s)

**Optimizaciones:**
1. Agregar índices a PostgreSQL
2. Limitar resultados: `limit: 10`
3. Usar filtros específicos: `page` o `section`

---

## 📚 Próximas Mejoras

- [ ] Búsqueda por rango de páginas: "páginas 4 a 6"
- [ ] Búsqueda fuzzy en nombres de secciones
- [ ] Highlighting de texto en UI
- [ ] Exportar referencias a PDF
- [ ] Búsqueda semántica con embeddings

---

**Documentación creada:** Marzo 2026  
**Autores:** Equipo de Desarrollo  
**Basado en:** PageIndex (VectifyAI), Cognee, FalkorDB
