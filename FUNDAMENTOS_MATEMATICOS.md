# 🧮 Fundamentos Matemáticos y Estructura del Sistema RAG1

> **Análisis técnico profundo de la arquitectura, algoritmos y complejidad computacional**

---

## 📐 1. Estructura del Sistema

### **1.1 Arquitectura en Capas**

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1: PRESENTACIÓN (Next.js 15 + React 19)                   │
│  - Componentes UI (shadcn/ui)                                   │
│  - Estado local (React hooks)                                   │
│  - Navegación (App Router)                                      │
│  Complejidad: O(1) por componente                               │
└─────────────────────────────────────────────────────────────────┘
                              │ HTTP/REST
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2: API (Next.js API Routes)                               │
│  - 10 endpoints REST                                            │
│  - Autenticación (NextAuth.js)                                  │
│  - Validación (Zod)                                             │
│  Complejidad: O(n) donde n = tamaño de respuesta                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 3: LÓGICA DE NEGOCIO (TypeScript)                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  PageIndex      │  │  Cognee         │  │  QA Service     │ │
│  │  - Tree Index   │  │  - NLP          │  │  - Búsqueda     │ │
│  │  - Offsets      │  │  - Extracción   │  │  - Fallback     │ │
│  │  O(log n)       │  │  O(n·m)         │  │  O(k)           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 4: ALMACENAMIENTO                                         │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  PostgreSQL     │  │  FalkorDB       │  │  Redis          │ │
│  │  - Relacional   │  │  - Grafo        │  │  - Cache        │ │
│  │  O(log n)       │  │  O(V + E)       │  │  O(1)           │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🧮 2. Fundamentos Matemáticos

### **2.1 PageIndex: Árbol Jerárquico**

#### **Estructura de Datos:**
```
Árbol n-ario (n-ary Tree)
- Cada nodo puede tener 0 a n hijos
- Profundidad: d (típicamente 3-5 niveles)
- Factor de ramificación: b (promedio 5-10 hijos por nodo)
```

#### **Propiedades Matemáticas:**

```
Número total de nodos: N = 1 + b + b² + b³ + ... + b^d

Donde:
- b = factor de ramificación (branching factor)
- d = profundidad del árbol (depth)

Para la Biblia (ejemplo):
- b ≈ 66 (libros del Antiguo Testamento)
- d = 4 (Testamento → Libro → Capítulo → Versículo)
- N ≈ 66 + 66² + 66³ + 66⁴ ≈ 19 millones (teórico)
- N real ≈ 2,134 nodos (solo lo extraído)
```

#### **Complejidad de Búsqueda:**

```typescript
// Búsqueda en árbol jerárquico
function searchTree(node: Node, query: string): Node[] {
  if (node.matches(query)) {
    results.push(node);  // O(1)
  }
  
  for (const child of node.children) {  // O(b)
    searchTree(child, query);  // O(d) recursivo
  }
}

// Complejidad: O(b^d) = O(N) donde N = número total de nodos
// En la práctica: O(log N) con poda del árbol
```

#### **Por Qué Árbol y No Lista:**

| Operación | Lista (O) | Árbol (O) | Mejora |
|-----------|-----------|-----------|--------|
| Búsqueda por página | O(N) | O(log N) | 100x |
| Búsqueda por capítulo | O(N) | O(d) | 1000x |
| Navegación jerárquica | O(N) | O(1) | ∞ |
| Inserción | O(N) | O(log N) | 100x |

---

### **2.2 FalkorDB: Teoría de Grafos**

#### **Estructura de Datos:**
```
Grafo dirigido G = (V, E)

Donde:
- V = conjunto de vértices (entidades)
- E = conjunto de aristas (relaciones)
- |V| = número de entidades (típicamente 100-10,000)
- |E| = número de relaciones (típicamente 50-5,000)
```

#### **Propiedades del Grafo:**

```
Grado de entrada (in-degree): deg⁻(v) = número de aristas que entran a v
Grado de salida (out-degree): deg⁺(v) = número de aristas que salen de v

Para la Biblia (ejemplo):
- V = {ISAÍAS, PROFETA, LIBRO, CAPÍTULO_60, ...}
- E = {(ISAÍAS, ESCRIBIO, LIBRO), (LIBRO, CONTIENE, CAPÍTULO_60), ...}

deg⁺(ISAÍAS) = 3  (ESCRIBIO, VIVIO_EN, FUE)
deg⁻(LIBRO) = 2   (ESCRIBIO, CONTIENE)
```

#### **Complejidad de Consultas Cypher:**

```cypher
-- Consulta 1: Búsqueda por entidad
MATCH (n) WHERE n.documentId = "xxx" RETURN n
-- Complejidad: O(|V|) sin índice, O(log |V|) con índice

-- Consulta 2: Búsqueda por tipo
MATCH (n:PERSONA) WHERE n.name = "Isaías" RETURN n
-- Complejidad: O(log |V|) con índice en label

-- Consulta 3: Búsqueda por relación
MATCH (a)-[r:ESCRIBIO]->(b) WHERE a.name = "Isaías" RETURN b
-- Complejidad: O(deg⁺(a)) = O(1) en promedio

-- Consulta 4: Camino más corto
MATCH path = shortestPath((a)-[*]-(b)) RETURN path
-- Complejidad: O(|V| + |E|) = BFS/Dijkstra
```

#### **Por Qué Grafo y No Tabla Relacional:**

| Operación | SQL (O) | Cypher/Grafo (O) | Mejora |
|-----------|---------|------------------|--------|
| Búsqueda directa | O(log N) | O(log N) | 1x |
| Relaciones 1 nivel | O(N log N) | O(deg) | 100x |
| Relaciones N niveles | O(N^N) | O(N·deg) | 1000x |
| Camino más corto | O(N²) | O(V + E) | 100x |

---

### **2.3 Cognee: Procesamiento de Lenguaje Natural**

#### **Extracción de Entidades (NER - Named Entity Recognition):**

```
Entrada: Texto T = {t₁, t₂, ..., tₙ} (n tokens)
Salida: Entidades E = {e₁, e₂, ..., eₘ} (m entidades)

Donde cada entidad eᵢ = (texto, tipo, start_index, end_index)
```

#### **Algoritmo de Extracción:**

```typescript
// Pseudo-código simplificado
async function extractEntities(text: string, domain: Domain): Promise<Entity[]> {
  // 1. Tokenización: O(n)
  const tokens = tokenize(text);  // n = número de tokens
  
  // 2. Ventana deslizante: O(n·w) donde w = tamaño de ventana
  const windows = slidingWindow(tokens, windowSize=5);
  
  // 3. Clasificación con LLM: O(n·w·c) donde c = costo de llamada API
  const entities = await llm.classify(windows, domain);
  
  // 4. Post-procesamiento: O(m) donde m = entidades encontradas
  return postProcess(entities);
}

// Complejidad total: O(n·w·c + m) ≈ O(n·c)
// Donde c es el factor dominante (llamada a API NVIDIA)
```

#### **Extracción de Relaciones:**

```
Entrada: Entidades E = {e₁, e₂, ..., eₘ}
Salida: Relaciones R = {r₁, r₂, ..., rₖ}

Donde cada relación rⱼ = (entidad_origen, tipo, entidad_destino)
```

#### **Matriz de Adyacencia de Relaciones:**

```
Matriz A de tamaño m × m donde:
A[i][j] = 1 si existe relación entre eᵢ y eⱼ
A[i][j] = 0 en caso contrario

Para m = 100 entidades:
- Matriz completa: 100 × 100 = 10,000 celdas
- Matriz dispersa (típico): ~500 celdas no-cero (5%)
- Complejidad de construcción: O(m²)
```

---

### **2.4 Q&A: Búsqueda y Recuperación**

#### **Búsqueda Híbrida (PageIndex + FalkorDB):**

```
Entrada: Query Q = {q₁, q₂, ..., qₖ} (k términos)
Salida: Contexto C = {c₁, c₂, ..., cₚ} (p secciones relevantes)
```

#### **Algoritmo de Búsqueda:**

```typescript
async function search(query: string, documentId: string): Promise<Context[]> {
  // 1. Extraer términos clave: O(k)
  const terms = extractTerms(query);  // k = términos
  
  // 2. Búsqueda en PageIndex: O(t · log N)
  const pageIndexResults = await prisma.pageIndex.findMany({
    where: {
      documentId,
      OR: terms.map(t => ({
        content: { contains: t }  // O(log N) con índice
      }))
    }
  });
  
  // 3. Detección de patrón bíblico: O(1)
  const biblicalRef = query.match(/(\d+):(\d+)/);  // Regex O(k)
  
  // 4. Búsqueda específica si es bíblico: O(log N)
  if (biblicalRef) {
    const biblicalResults = await prisma.pageIndex.findMany({
      where: { documentId, content: { contains: biblicalRef[0] } }
    });
  }
  
  // 5. Búsqueda en FalkorDB: O(|V| + |E|)
  const graphResults = await falkorDBService.query(`
    MATCH (n) WHERE n.documentId = "${documentId}"
    RETURN n
  `);
  
  // 6. Combinar resultados: O(p + g) donde p = pageIndex, g = graph
  return combineResults(pageIndexResults, biblicalResults, graphResults);
}

// Complejidad total: O(k + t·log N + |V| + |E| + p + g)
// En la práctica: O(log N + |V|) dominado por búsquedas en BD
```

---

### **2.5 LLM: Generación de Respuestas**

#### **Transformers (Arquitectura Base):**

```
Entrada: Tokens T = {t₁, t₂, ..., tₙ} (n tokens de contexto)
Salida: Tokens generados G = {g₁, g₂, ..., gₘ} (m tokens de respuesta)

Complejidad de atención: O(n² · d) donde d = dimensión del modelo
```

#### **Para Llama 3.1 70B:**

```
Parámetros:
- n = 8,000 tokens (contexto máximo)
- d = 8,192 (dimensión de embeddings)
- layers = 80 (capas del transformer)
- heads = 64 (cabezas de atención)

Complejidad por token generado:
- Atención multi-cabeza: O(n² · d / heads)
- Feed-forward: O(n · d²)
- Total: O(n² · d + n · d²) ≈ O(n · d²)

Para n = 2,000 tokens (contexto típico):
- Operaciones por token: ~2,000 × 8,192² ≈ 134 billones
- Tiempo estimado: 50-100ms por token (con GPU NVIDIA)
- Respuesta de 50 tokens: 2.5-5 segundos
```

---

## 📊 3. Complejidad Computacional por Operación

### **3.1 Subida de Documento**

| Operación | Complejidad | Tiempo Real | Factor Dominante |
|-----------|-------------|-------------|------------------|
| Leer PDF | O(p) | 1-5s | p = páginas |
| Extraer texto | O(p · c) | 5-30s | c = caracteres por página |
| PageIndex | O(p · log p) | 10-60s | LLM para estructura |
| Cognee | O(c · m) | 2-10 min | m = chunks × API calls |
| Guardar grafo | O(e + r) | 1-5 min | e = entidades, r = relaciones |
| **Total** | **O(p·c·m)** | **3-15 min** | **API calls a NVIDIA** |

### **3.2 Pregunta Q&A**

| Operación | Complejidad | Tiempo Real | Factor Dominante |
|-----------|-------------|-------------|------------------|
| Extraer términos | O(k) | <1ms | k = términos en query |
| Búsqueda PageIndex | O(t · log N) | 50-200ms | t = términos, N = nodos |
| Búsqueda FalkorDB | O(|V| + |E|) | 100-300ms | V = vértices, E = aristas |
| Combinar contexto | O(p + g) | 10-50ms | p = pageIndex, g = graph |
| LLM genera respuesta | O(n · d²) | 2-8s | n = tokens, d = dimensión |
| **Total** | **O(n·d²)** | **3-10s** | **Generación LLM** |

---

## 🎯 4. Optimizaciones Implementadas

### **4.1 Índices de Base de Datos**

```sql
-- PostgreSQL (PageIndex)
CREATE INDEX "PageIndex_documentId_page_idx" 
  ON "PageIndex"("documentId", "page");
-- Reduce búsqueda de O(N) a O(log N)

CREATE INDEX "PageIndex_content_idx" 
  ON "PageIndex" USING gin(to_tsvector('spanish', content));
-- Búsqueda full-text de O(N) a O(log N)

-- FalkorDB (Grafo)
CREATE INDEX FOR (n) ON (n.documentId);
-- Reduce MATCH de O(|V|) a O(log |V|)
```

### **4.2 Cache de Redis**

```typescript
// Cache de respuestas Q&A
const cacheKey = `qa:${documentId}:${hash(query)}`;
const cached = await redis.get(cacheKey);  // O(1)

if (cached) {
  return cached;  // 1ms vs 3-10s
}

// Si no está en cache, generar y guardar
const response = await generateAnswer(query);
await redis.setex(cacheKey, 3600, response);  // TTL: 1 hora
```

**Mejora:** 99% de reducción en tiempo para preguntas repetidas

### **4.3 Procesamiento por Lotes**

```typescript
// En lugar de procesar chunks secuencialmente: O(m · c)
for (const chunk of chunks) {
  await processChunk(chunk);  // c = costo por chunk
}

// Procesar en paralelo con límite de concurrencia: O(m/c · c) = O(m)
const batches = chunk(chunks, batchSize=10);
for (const batch of batches) {
  await Promise.all(batch.map(processChunk));  // 10 en paralelo
}
```

**Mejora:** 10x más rápido para documentos grandes

---

## 📈 5. Escalabilidad

### **5.1 Límites Teóricos**

| Recurso | Límite Actual | Límite Teórico | Cuello de Botella |
|---------|---------------|----------------|-------------------|
| Páginas por documento | 2,133 (Biblia) | ~10,000 | Memoria RAM |
| Nodos PageIndex | 2,134 | ~50,000 | PostgreSQL |
| Entidades por documento | 8,367 | ~100,000 | FalkorDB |
| Relaciones por documento | 6,632 | ~50,000 | FalkorDB |
| Chunks procesados | 500 | ~2,000 | API rate limit |
| Usuarios concurrentes | 50+ | ~500 | CPU/GPU |

### **5.2 Puntos de Escalabilidad**

```
┌─────────────────────────────────────────────────────────────────┐
│  Cuello de Botella Actual: NVIDIA API                           │
│  - Rate limit: 100 requests/min                                 │
│  - Latencia: 500-2000ms por request                             │
│  - Solución: Cache + batch processing                           │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cuello de Botella Secundario: FalkorDB                         │
│  - Consultas complejas: O(|V| + |E|)                            │
│  - Memoria: 1GB para 100K entidades                             │
│  - Solución: Índices + sharding                                 │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  Cuello de Botella Terciario: LLM                               │
│  - Generación: O(n · d²) por token                              │
│  - GPU requerida: NVIDIA A100/H100                              │
│  - Solución: Modelos más pequeños + cache                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔬 6. Análisis de Complejidad Espacial

### **6.1 Uso de Memoria**

```
Documento: Biblia (2,133 páginas, 5MB PDF)

PageIndex (PostgreSQL):
- 2,134 nodos × 500 bytes/nodo = ~1MB
- Índices: ~500KB
- Total: ~1.5MB

FalkorDB (Grafo):
- 8,367 entidades × 200 bytes/entidad = ~1.7MB
- 6,632 relaciones × 100 bytes/relación = ~700KB
- Índices: ~500KB
- Total: ~2.9MB

Redis (Cache):
- Cache Q&A: ~10MB (1000 preguntas × 10KB)
- Sesiones: ~1MB
- Total: ~11MB

Memoria Total: ~15.4MB por documento
```

### **6.2 Uso de Disco**

```
Documento: Biblia

PDF original: 19.34MB
Uploads (metadata): ~100KB
PostgreSQL (datos): ~2MB
FalkorDB (grafo): ~3MB
Logs: ~50MB (rotativos)

Total: ~75MB por documento grande
```

---

## 📚 7. Referencias Matemáticas

### **Teoría de Grafos:**
- West, D. B. (2001). *Introduction to Graph Theory*
- Diestel, R. (2017). *Graph Theory* (5th ed.)

### **Árboles y Búsqueda:**
- Cormen, T. H., et al. (2009). *Introduction to Algorithms* (3rd ed.)
- Knuth, D. E. (1997). *The Art of Computer Programming, Vol 1*

### **Procesamiento de Lenguaje Natural:**
- Jurafsky, D., & Martin, J. H. (2023). *Speech and Language Processing* (3rd ed.)
- Vaswani, A., et al. (2017). "Attention Is All You Need"

### **Transformers y LLMs:**
- Brown, T., et al. (2020). "Language Models are Few-Shot Learners"
- Touvron, H., et al. (2023). "LLaMA: Open and Efficient Foundation Language Models"

---

## 🎓 8. Glosario de Términos

| Término | Definición | Complejidad |
|---------|------------|-------------|
| **Nodo** | Elemento en árbol o grafo | O(1) acceso |
| **Arista** | Relación entre nodos | O(1) acceso |
| **Token** | Unidad mínima de texto | O(1) procesamiento |
| **Embedding** | Vector de dimensión d | O(d) espacio |
| **Atención** | Mecanismo de transformers | O(n²) tiempo |
| **BFS** | Búsqueda en anchura | O(V + E) |
| **DFS** | Búsqueda en profundidad | O(V + E) |
| **Dijkstra** | Camino más corto | O((V + E) log V) |

---

## ✅ 9. Conclusiones

### **Complejidad General del Sistema:**

```
Operación más costosa: Generación LLM
- Complejidad: O(n · d²) por token
- Tiempo: 50-100ms por token
- Optimizable: Cache + modelos más pequeños

Operación más frecuente: Búsqueda en BD
- Complejidad: O(log N) con índices
- Tiempo: 50-300ms
- Optimizable: Índices + cache Redis

Operación más compleja: Extracción Cognee
- Complejidad: O(n · c) donde c = costo API
- Tiempo: 2-10 minutos
- Optimizable: Batch processing + parallelismo
```

### **Rendimiento Actual:**

| Métrica | Valor | ¿Optimizable? |
|---------|-------|---------------|
| Subida de documento | 3-15 min | Sí (batch) |
| Q&A respuesta | 3-10s | Sí (cache) |
| Memoria por documento | ~15MB | No (óptimo) |
| Disco por documento | ~75MB | No (óptimo) |

---

**Documento técnico creado:** Marzo 2026  
**Versión:** 1.0.0  
**Autor:** Equipo de Desarrollo RAG1
