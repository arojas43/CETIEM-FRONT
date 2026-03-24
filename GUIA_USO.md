# Guía de Uso

---

## 1. Subir un documento

1. Ir a **Dashboard → Subir Documento**
2. Arrastrar un PDF o hacer clic para seleccionar
3. Agregar descripción opcional
4. Clic en **Subir Documento para Análisis**

El archivo se guarda en `./uploads/{id}/{id}.pdf` y se encola para procesamiento automático. Si Redis no está disponible, queda en estado `PENDIENTE` y debes procesarlo manualmente.

**Límites:**
- Solo archivos PDF
- Hasta 50MB para procesamiento estándar (pdfjs-dist)
- Más de 50MB usa `pdftotext` (poppler) con chunking automático

---

## 2. Procesar un documento

El procesamiento ocurre automáticamente al subir si Redis está disponible. Si el documento quedó en `PENDIENTE` o quieres reprocesarlo:

1. Ir al documento → clic en **Procesar**
2. Seleccionar el dominio que corresponde al contenido:

| Dominio | Usar cuando el documento es... |
|---------|-------------------------------|
| **Legal** (default) | Normas ISO, contratos, reglamentos, cumplimiento |
| **Medical** | Historiales clínicos, protocolos, farmacología |
| **Technical** | Manuales técnicos, especificaciones, equipos |
| **Academic** | Artículos científicos, tesis, investigación |
| **Custom** | Cualquier otro tipo de documento |

3. Esperar a que la barra de progreso llegue al 100%

**Etapas del procesamiento:**
- `3-45%` — PageIndex: extrae texto y estructura jerárquica
- `45-95%` — Cognee: extrae entidades y relaciones chunk por chunk
- `95-100%` — Verificación en FalkorDB y actualización de estado

Si el estado final es `ANALIZADO` significa que se encontraron entidades en FalkorDB. Si queda en `INDEXADO` significa que PageIndex funcionó pero Cognee no encontró entidades (puede pasar con documentos muy cortos o sin contenido semántico claro).

---

## 3. Hacer preguntas (Q&A)

Ir al documento → **Preguntar al Documento**.

### Tipos de preguntas soportadas

**Por página:**
```
¿Qué dice la página 15?
¿Qué información hay en la página 4?
```

**Por sección o capítulo:**
```
¿De qué trata la sección 3.2?
¿Qué dice el capítulo II?
```

**Por párrafo:**
```
¿Qué dice el tercer párrafo de la página 7?
¿Cuál es el segundo párrafo de la sección 4?
```

**Por contenido:**
```
¿Qué requisitos hay para la certificación ISO 9001?
¿Cuáles son los procedimientos de auditoría interna?
¿Qué normas aplican para manejo de residuos?
```

**Referencias bíblicas** (si el documento es una Biblia u obra religiosa):
```
¿Qué dice Isaías 60:9-22?
¿Cuál es el contenido de Juan 3:16?
```

### Cómo funciona internamente

1. El sistema detecta si la pregunta menciona página, sección o párrafo específico
2. Si es específica, busca directamente en el índice PageIndex
3. Si es general, usa **LLM Tree Search**: le muestra al LLM el árbol de secciones del documento y le pide que identifique cuáles son relevantes
4. Como fallback usa búsqueda por keywords en títulos y contenido
5. Enriquece el contexto con entidades de FalkorDB de las páginas relevantes
6. Genera la respuesta final con **Qwen 3.5 122B** (streaming)

Las respuestas incluyen referencias de página para que puedas verificar la información en el documento original.

---

## 4. Explorar el grafo de conocimiento

Ir al documento → **Grafo de Entidades**.

Muestra todas las entidades y relaciones extraídas por Cognee para ese documento. Las entidades están organizadas por tipo (ORGANIZATION, REGULATION, REQUIREMENT, PERSON, etc. según el dominio).

Si el grafo muestra 0 relaciones en un documento procesado antes de marzo 2026, usa el botón **Reprocesar** — había un bug donde el LLM siempre retornaba `"relations": []`.

---

## 5. Consultas Cypher directas

Ir a **Dashboard → Explorador de Grafo** para ejecutar consultas Cypher sobre FalkorDB.

Ejemplos útiles:

```cypher
-- Ver todas las entidades de un documento
MATCH (n) WHERE n.documentId = "tu-document-id" RETURN n LIMIT 50

-- Ver relaciones
MATCH (a)-[r]->(b) WHERE a.documentId = "tu-document-id" RETURN a.name, type(r), b.name LIMIT 30

-- Buscar por tipo
MATCH (n:REGULATION) WHERE n.documentId = "tu-document-id" RETURN n.name, n.description

-- Ver estadísticas del grafo completo
MATCH (n) RETURN labels(n)[0] AS tipo, count(n) AS cantidad ORDER BY cantidad DESC

-- Contar relaciones por tipo
MATCH ()-[r]->() RETURN type(r) AS relacion, count(r) AS cantidad ORDER BY cantidad DESC
```

---

## 6. Estados de un documento

| Estado | Significado |
|--------|------------|
| `PENDIENTE` | Subido, esperando procesamiento |
| `PROCESANDO` | En proceso ahora mismo |
| `INDEXADO` | PageIndex completado, Cognee sin entidades |
| `ANALIZADO` | Completamente procesado con entidades en grafo |
| `FALLIDO` | Error en procesamiento (ver descripción del documento) |

---

## 7. Reprocesar documentos

Cualquier documento puede reprocesarse desde su página de detalle. Útil cuando:
- Cambias el dominio y quieres mejores entidades
- El procesamiento anterior falló parcialmente
- Se aplicaron correcciones al pipeline de Cognee

Al reprocesar se eliminan los nodos anteriores de PageIndex y FalkorDB para ese documento y se ejecuta el pipeline completo desde cero.
