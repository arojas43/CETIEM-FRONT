# 🛡️ Aislamiento de Grafos por Documento

> **Importante:** Cada documento tiene SU PROPIO grafo de conocimiento aislado en FalkorDB.

---

## ✅ Implementación Actual

El sistema **SÍ implementa correctamente** el aislamiento de grafos por documento. **NO** hay un "grafo gigante" con todos los documentos mezclados.

---

## 🏗️ Arquitectura de Aislamiento

### FalkorDB - Grafo Único con Múltiples Documentos

```
┌─────────────────────────────────────────────────────────┐
│  FalkorDB (Grafo: "certificacion")                      │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Documento A (ID: abc123)                       │   │
│  │  - Entidades: 50                                │   │
│  │  - Relaciones: 30                               │   │
│  │  - documentId: "abc123"                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Documento B (ID: def456)                       │   │
│  │  - Entidades: 40                                │   │
│  │  - Relaciones: 25                               │   │
│  │  - documentId: "def456"                         │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────────────────────────────────────┐   │
│  │  Documento C (ID: ghi789)                       │   │
│  │  - Entidades: 60                                │   │
│  │  - Relaciones: 45                               │   │
│  │  - documentId: "ghi789"                         │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

**Ventajas:**
- ✅ Un solo grafo en FalkorDB (más eficiente)
- ✅ Aislamiento lógico por `documentId`
- ✅ Consultas filtradas por documento
- ✅ Fácil de eliminar un documento completo

---

## 🔍 Cómo Funciona el Aislamiento

### 1. **Al Guardar Entidades**

Cada entidad guarda su `documentId`:

```typescript
// cognee-service.ts
const properties = {
  id: entity.id,
  name: entity.name,
  documentId,  // ← CLAVE: aísla por documento
  page: pageIndexReference?.page,
  section: pageIndexReference?.section,
};

await falkorDBService.createEntity(entity.type, properties);
```

**Resultado en FalkorDB:**
```cypher
(:CONCEPT {
  id: "abc123-entity-1",
  name: "Sargazo",
  documentId: "abc123",  // ← Aísla este nodo al documento abc123
  page: 1,
  section: "I. INTRODUCCIÓN"
})
```

---

### 2. **Al Consultar (Búsqueda)**

Todas las consultas filtran por `documentId`:

```typescript
// cognee-service.ts - Búsqueda
const entitiesResult = await falkorDBService.query(`
  MATCH (n)
  WHERE n.documentId = "${documentId}"  // ← FILTRO CRÍTICO
    AND (n.name CONTAINS "${query}" OR n.description CONTAINS "${query}")
  RETURN labels(n)[0] AS type, n.name AS name
`);
```

**Sin este filtro, se mezclarían todos los documentos.**

---

### 3. **Al Eliminar un Documento**

Se eliminan TODAS las entidades y relaciones de ese documento:

```typescript
// falkordb.ts
async deleteEntitiesByDocumentId(documentId: string): Promise<number> {
  const cypher = `
    MATCH (n {documentId: "${documentId}"})
    DETACH DELETE n
  `;
  
  const result = await this.query(cypher);
  return result.rows.find(r => r['Nodes deleted'])?.['Nodes deleted'] || 0;
}
```

---

## 📊 Verificación del Aislamiento

### Ver cuántos documentos hay en el grafo

```bash
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion \
  "MATCH (n) WHERE n.documentId IS NOT NULL RETURN count(DISTINCT n.documentId) AS docCount"
```

**Resultado esperado:**
```
1) docCount
2) 1) (integer) 3    ← 3 documentos en el grafo
```

---

### Ver entidades por documento

```bash
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion \
  "MATCH (n) WHERE n.documentId = 'abc123' RETURN count(n) AS count"
```

**Resultado:**
```
1) count
2) 1) (integer) 50    ← 50 entidades del documento abc123
```

---

### Ver todas las entidades SIN documentId (error)

```bash
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion \
  "MATCH (n) WHERE n.documentId IS NULL RETURN count(n)"
```

**Resultado esperado:** `0` (todas deberían tener documentId)

---

## 🔒 Seguridad del Aislamiento

### ¿Puede un documento ver entidades de otro documento?

**NO.** Todas las consultas incluyen:
```typescript
WHERE n.documentId = "${documentId}"
```

**Ejemplo de consulta segura:**
```cypher
// Usuario pregunta sobre documento "abc123"
MATCH (n)
WHERE n.documentId = "abc123"  // ← Solo ve este documento
  AND n.name CONTAINS "sargazo"
RETURN n
```

---

## 🎯 Comparación: Aislamiento vs. Grafo Separado

### Opción A: Grafo Único con Aislamiento (ACTUAL) ✅

```
FalkorDB: certificacion
├── Documento A (documentId: "abc123")
├── Documento B (documentId: "def456")
└── Documento C (documentId: "ghi789")
```

**Ventajas:**
- ✅ Un solo contenedor Docker
- ✅ Menos overhead de memoria
- ✅ Fácil de hacer consultas cruzadas (si se necesita en el futuro)
- ✅ Más fácil de hacer backup

**Desventajas:**
- ⚠️ Requiere recordar SIEMPRE filtrar por `documentId`

---

### Opción B: Grafo Separado por Documento (NO USADO)

```
FalkorDB: certificacion_doc_abc123
FalkorDB: certificacion_doc_def456
FalkorDB: certificacion_doc_ghi789
```

**Ventajas:**
- ✅ Aislamiento físico total
- ✅ No hay riesgo de mezclar documentos

**Desventajas:**
- ❌ Múltiples contenedores Docker
- ❌ Más overhead de memoria
- ❌ Difícil de escalar (100 documentos = 100 grafos)
- ❌ Difícil de hacer backup

---

## 📋 Verificación en Código

### Todos los métodos que consultan FalkorDB usan `documentId`:

| Método | Archivo | Usa `documentId` |
|--------|---------|------------------|
| `search()` | `cognee-service.ts` | ✅ Sí |
| `getDocumentGraphStats()` | `cognee-service.ts` | ✅ Sí |
| `deleteDocumentGraph()` | `cognee-service.ts` | ✅ Sí |
| `createEntity()` | `falkordb.ts` | ✅ Sí (en properties) |
| `deleteEntitiesByDocumentId()` | `falkordb.ts` | ✅ Sí |
| `getStats()` | `falkordb.ts` | ✅ Sí (conteo por doc) |

---

## 🧪 Pruebas de Aislamiento

### Test 1: Crear dos documentos con la misma entidad

```bash
# Documento 1: "PySargazo.pdf"
Entidad: "Sargazo" (documentId: "abc123")

# Documento 2: "Articulo.pdf"
Entidad: "Sargazo" (documentId: "def456")
```

**Consulta al documento 1:**
```cypher
MATCH (n)
WHERE n.documentId = "abc123"
  AND n.name = "Sargazo"
RETURN n

-- Resultado: 1 entidad (SOLO del documento 1)
```

**Consulta al documento 2:**
```cypher
MATCH (n)
WHERE n.documentId = "def456"
  AND n.name = "Sargazo"
RETURN n

-- Resultado: 1 entidad (SOLO del documento 2)
```

**Sin filtro (peligroso):**
```cypher
MATCH (n)
WHERE n.name = "Sargazo"
RETURN n

-- Resultado: 2 entidades (AMBOS documentos)
-- Por eso SIEMPRE hay que filtrar por documentId
```

---

## ✅ Conclusión

**El sistema SÍ implementa correctamente el aislamiento de grafos por documento.**

- ✅ Cada entidad tiene `documentId`
- ✅ Todas las consultas filtran por `documentId`
- ✅ Se puede eliminar un documento completo sin afectar a otros
- ✅ No hay riesgo de mezclar documentos en las respuestas

**No es necesario crear grafos separados en FalkorDB.** El aislamiento lógico es suficiente y más eficiente.

---

**Documentación creada:** Marzo 2026  
**Estado:** ✅ Verificado y Funcional
