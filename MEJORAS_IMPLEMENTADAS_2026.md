# 🚀 Mejorías de Implementación - PageIndex + Cognee + FalkorDB

## Resumen Ejecutivo

Se han realizado mejoras significativas al sistema de certificación empresarial con IA para alinearlo con las mejores prácticas de las documentaciones oficiales de **PageIndex**, **Cognee** y **FalkorDB**.

---

# 🎨 Rediseño CETIEM + Correcciones de Bugs — Marzo 2026

## Resumen

Implementación completa del diseño visual CETIEM basado en el Moodboard oficial, más correcciones de bugs críticos en el pipeline de Q&A y FalkorDB.

---

## 1. 🎨 Rediseño Visual Completo (CETIEM Design System)

### Paleta de colores implementada
| Token | Valor | Uso |
|-------|-------|-----|
| `cetiem-green` | `#1d9e75` | Acción principal, CTAs, progreso |
| `cetiem-lime` | `#9fc031` | Análisis completado, gráficas |
| `cetiem-teal` | `#1e7d93` | Q&A, búsqueda, información |
| `cetiem-amber` | `#ffbf00` | Advertencias, procesamiento pendiente |
| `cetiem-red` | `#aa3939` | Errores, eliminación |
| `cetiem-gray` | `#8b8d98` | Texto secundario, iconos inactivos |
| `cetiem-dark` | `#05070b` | Fondo principal |
| `cetiem-card` | `#0a0d13` | Fondo de tarjetas |

### Tipografía
- **Headings**: Bricolage Grotesque Bold (variable `--font-bricolage`)
- **Body**: Inter Regular (variable `--font-inter`)

### Archivos modificados — UI
| Archivo | Cambio |
|---------|--------|
| `tailwind.config.js` | Tokens cetiem.* fusionados con shadcn colors (fix bug de doble `colors`) |
| `src/app/globals.css` | Variables CSS dark mode, fix `@apply border-border` → CSS directo |
| `src/app/layout.tsx` | Fuentes Bricolage Grotesque + Inter |
| `src/app/page.tsx` | Homepage dark theme CETIEM |
| `src/components/auth.tsx` | Signin dark theme |
| `src/app/dashboard/layout.tsx` | **NUEVO** — Layout con sidebar, auth guard |
| `src/components/sidebar.tsx` | **NUEVO** — Navegación lateral con estado activo |
| `src/app/dashboard/page.tsx` | Dashboard con donut chart SVG, KPI cards |
| `src/app/dashboard/documents/page.tsx` | Lista de documentos dark |
| `src/app/dashboard/upload/page.tsx` | Subida con dropzone dark |
| `src/app/dashboard/graph/page.tsx` | Editor Cypher dark, tabla de resultados |
| `src/app/dashboard/documents/[id]/page.tsx` | Detalle documento dark |
| `src/app/dashboard/documents/[id]/process-button.tsx` | Botón procesar dark |
| `src/app/dashboard/documents/[id]/qa/page.tsx` | Q&A dark con referencias |
| `src/app/dashboard/documents/[id]/graph/page.tsx` | Grafo entidades dark |
| `src/app/dashboard/documents/[id]/content/page.tsx` | Contenido paginado dark |
| `src/components/document-list-paginated.tsx` | Lista documentos dark completa |
| `src/components/processing-progress.tsx` | Barras de progreso con colores cetiem |
| `src/components/markdown-renderer.tsx` | Renderer Markdown dark (fix texto invisible) |

---

## 2. 🐛 Bug Fixes

### Bug 1: `tailwind.config.js` — doble bloque `colors`
**Síntoma:** Error `The border-border class does not exist` al arrancar Next.js.

**Causa:** Dos bloques `colors` separados dentro de `theme.extend` — el segundo sobreescribía al primero, eliminando el color `border` que shadcn/ui necesita.

**Fix:** Fusionados en un único objeto `colors` con todos los tokens (shadcn + cetiem).

---

### Bug 2: `globals.css` — `@apply border-border` incompatible
**Síntoma:** Mismo error `border-border class does not exist` persistía con el servidor en caché.

**Fix:** Reemplazado `@apply border-border` por `border-color: hsl(var(--border))` directo — equivalente funcional, sin depender de la resolución de clases en PostCSS.

---

### Bug 3: `markdown-renderer.tsx` — texto invisible en dark mode
**Síntoma:** Las respuestas del Q&A se mostraban pero el texto era casi invisible (colores `text-gray-800` sobre fondo oscuro).

**Causa:** El renderer usaba clases Tailwind light-mode (`text-gray-800`, `text-gray-900`, `bg-gray-100`) que son oscuras sobre fondo oscuro.

**Fix:** Todos los colores actualizados a tokens cetiem dark-compatible:
- Párrafos: `text-cetiem-white/90`
- Encabezados: `text-white`
- Negrita: `font-semibold text-white`
- Código inline: `bg-white/10 text-cetiem-teal`
- Bloques de código: `bg-white/5 border border-white/10 text-cetiem-white`
- Separadores: `border-white/10`

---

### Bug 4: `pageindex-local.ts` — todas las páginas con el mismo texto
**Síntoma:** Al procesar un PDF sin OCR, todos los nodos `Página N` del índice recibían el mismo contenido (los primeros 1000 chars del documento completo).

**Causa:** `pdf-parse` devuelve texto concatenado sin separación por página. El código hacía `result.text.slice(0, 1000)` para cada página en lugar de dividir proporcionalmente.

**Fix:**
```ts
// Antes (bug):
pages.push(`Página ${i + 1} de ${result.numpages}\n\n${result.text.slice(0, 1000)}`);

// Después (fix):
const charsPerPage = Math.ceil(result.text.length / Math.max(result.numpages, 1));
const start = i * charsPerPage;
const end = Math.min((i + 1) * charsPerPage, result.text.length);
pages.push(`Página ${i + 1} de ${result.numpages}\n\n${result.text.slice(start, end)}`);
```

> **Nota:** Aplica a documentos procesados desde este commit. Documentos anteriores mantienen el contenido incorrecto hasta ser reprocesados.

---

### Bug 5: `search/route.ts` — dead code (if/else duplicado)
**Síntoma:** Código duplicado sin efecto funcional, import sin usar.

**Causa:** Ambas ramas del `if (isSpecificLocation)` llamaban exactamente la misma función. El import de `cogneeService` en el POST handler era innecesario.

**Fix:** Eliminado el if/else, colapsado en una sola llamada directa a `qaService.answerSpecificQuestion()`.

---

### Bug 6: `falkordb.ts` — 20 errores "already indexed" en cada conexión
**Síntoma:** En cada arranque de proceso Next.js aparecían 20 líneas de error en el log:
```
[FalkorDB] Error en consulta: Attribute 'documentId' is already indexed
[FalkorDB] Cypher: CREATE INDEX FOR (n:ORGANIZATION) ON (n.documentId)
```

**Causa:** `_indexesEnsured` es un flag de módulo que se resetea cuando Next.js crea un nuevo worker. FalkorDB no tiene sintaxis `IF NOT EXISTS` para índices — intentar crear un índice existente genera error.

**Fix:** `ensureIndexes()` ahora consulta primero `CALL db.indexes()` para obtener los índices existentes, y solo crea los que faltan:
```ts
const indexResult = await this.query('CALL db.indexes()');
// Solo crea índices que no existen en indexResult
```

---

## 3. ⚡ Optimizaciones Q&A

### Qwen 3.5 122B — timeout eliminado
**Síntoma:** `NetworkError when attempting to fetch resource` — el browser cortaba la conexión a los ~60s mientras Qwen tardaba 63s.

**Causa:** `enable_thinking: true` activa razonamiento interno extendido (chain-of-thought), innecesario para Q&A documental.

**Cambios en `qwen-qa.ts`:**
| Parámetro | Antes | Después | Impacto |
|-----------|-------|---------|---------|
| `enable_thinking` | `true` | eliminado | -50s por query |
| `max_tokens` | 16384 | 4096 | Respuestas más rápidas |
| `temperature` | 0.6 | 0.4 | Más precisión al citar páginas |

**`maxDuration = 120`** agregado a `src/app/api/documents/[id]/search/route.ts` como red de seguridad.

---

## 4. Arquitectura — sin cambios

El pipeline de procesamiento y consulta no fue modificado:
- **PageIndex** → extracción jerárquica de PDF → PostgreSQL (`PageIndex` table)
- **Cognee (custom TS)** → extracción de entidades/relaciones → FalkorDB
- **Q&A** → `qaService.answerSpecificQuestion()` → LLM Tree Search + keyword fallback → Qwen 3.5 122B
- **Workers** → BullMQ + Redis (sin cambios)
- **Auth** → NextAuth v5 (sin cambios)
