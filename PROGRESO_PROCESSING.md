# 📊 Barras de Progreso en Tiempo Real - Documentación

> **Sistema de tracking de procesamiento de documentos con actualizaciones en vivo**

---

## 🎯 ¿Qué Son las Barras de Progreso?

Las barras de progreso muestran el **estado actual del procesamiento** de cada documento, permitiendo a los usuarios saber exactamente en qué etapa está su documento y cuánto falta para completar.

---

## 📈 Etapas de Procesamiento

### **Vista General:**

```
0% ─────────────────────────────────────────────────────── 100%
│         │         │         │         │         │
│         │         │         │         │         └─► 100%: Completado
│         │         │         │         └─► 80%: Cognee analizando
│         │         │         └─► 60%: PageIndex completado
│         │         └─► 30%: Extrayendo texto
│         └─► 10%: Obteniendo documento
└─► 0%: En cola
```

---

## 🔄 Flujo Detallado de Progreso

### **Fase 1: PageIndex (0% - 60%)**

| %  | Estado | Descripción | Duración Típica |
|----|--------|-------------|-----------------|
| **0-5%** | En cola | Documento esperando procesamiento | Variable |
| **5%** | Iniciando PageIndex | Worker comienza el procesamiento | <1s |
| **10%** | Obteniendo documento | Cargando metadata de BD | 1-2s |
| **15%** | Cargando metadatos | Leyendo información del archivo | 1-2s |
| **20%** | Analizando PDF | Verificando tamaño y tipo | 1-3s |
| **30-50%** | Extrayendo texto | Leyendo contenido del PDF | 10-60s |
| **40%** | Extrayendo estructura | PageIndex detecta jerarquía | 5-30s |
| **45%** | Índice construido | Estructura de árbol creada | <1s |
| **48-50%** | Guardando índices | Persistiendo en PostgreSQL | 5-20s |
| **52%** | Encolando análisis | Enviando a cola de Cognee | 1-2s |
| **55-60%** | Completando indexación | Actualizando estado a INDEXED | 1-2s |

### **Fase 2: Cognee (60% - 100%)**

| %  | Estado | Descripción | Duración Típica |
|----|--------|-------------|-----------------|
| **60-70%** | Preparando análisis | Cargando índices para Cognee | 5-10s |
| **70-80%** | Extrayendo entidades | LLM identifica conceptos | 30-120s |
| **80-90%** | Creando relaciones | Conectando entidades | 20-60s |
| **90-95%** | Guardando en grafo | Persistiendo en FalkorDB | 10-30s |
| **95-99%** | Finalizando | Últimas actualizaciones | 5-10s |
| **100%** | ✓ Completado | Documento ANALYZED | <1s |

---

## 🎨 Componente UI: ProcessingProgress

### **Uso:**

```tsx
import { ProcessingProgress } from "@/components/processing-progress";

// En tu componente
<ProcessingProgress
  documentId={doc.id}
  status={doc.status}
  className="mt-2"
/>
```

### **Comportamiento:**

1. **Polling automático:** Consulta cada 2 segundos
2. **Solo activo cuando procesa:** Se detiene en ANALYZED/FAILED
3. **Colores por etapa:**
   - 🔵 Azul: PageIndex
   - 🟣 Morado: Cognee/Análisis
   - 🔴 Rojo: Error
   - 🟢 Verde: Completado

### **Información Mostrada:**

```
┌─────────────────────────────────────────────┐
│  ████████████░░░░░░░░░░░░░░░░░░░░░  45%    │
│  ⏱️  Extrayendo estructura                  │
│  📑 150 índices creados                     │
│  📄 19.34 MB                                │
└─────────────────────────────────────────────┘
```

---

## 🔧 Implementación Técnica

### **Backend:**

#### **1. Schema de Prisma:**

```prisma
model Document {
  processingProgress Json?  // { step, percentage, details, updatedAt }
  // ...
}
```

#### **2. Endpoint API:**

```typescript
// GET /api/documents/[id]/progress
// Obtiene progreso actual

// POST /api/documents/[id]/progress
// Actualiza progreso
{
  step: "Extrayendo texto",
  percentage: 35,
  details: {
    stage: "extracting",
    extractionProgress: { percentage: 50 },
    fileSize: 20000000,
  }
}
```

#### **3. Función updateProgress:**

```typescript
async function updateProgress(
  documentId: string,
  step: string,
  percentage: number,
  details: Record<string, any>
): Promise<void> {
  await prisma.document.update({
    where: { id: documentId },
    data: {
      processingProgress: {
        step,
        percentage: Math.min(percentage, 99),
        details,
        updatedAt: new Date().toISOString(),
      },
    },
  });
}
```

### **Frontend:**

#### **Polling Hook:**

```typescript
useEffect(() => {
  const fetchProgress = async () => {
    const response = await fetch(`/api/documents/${id}/progress`);
    const data = await response.json();
    setProgress(data.progress);
  };

  fetchProgress();
  const interval = setInterval(fetchProgress, 2000);
  return () => clearInterval(interval);
}, [id]);
```

---

## 📊 Ejemplos de Progreso

### **Documento Pequeño (<50 páginas):**

```
00:00 - 0%  - En cola
00:02 - 10% - Obteniendo documento
00:05 - 30% - Extrayendo texto
00:15 - 50% - Índices guardados: 45
00:20 - 60% - ✓ Indexación completada
01:00 - 80% - Extrayendo entidades
02:30 - 100% - ✓ Completado
```

### **Documento Grande (Biblia - 2133 páginas):**

```
00:00 - 0%   - En cola
00:03 - 10%  - Obteniendo documento
00:10 - 30%  - Extrayendo texto (documento grande)
02:30 - 45%  - Índice construido
03:00 - 50%  - Índices guardados: 2134
03:10 - 60%  - ✓ Indexación completada
05:00 - 70%  - Extrayendo entidades (567 chunks)
15:00 - 85%  - Creando relaciones
25:00 - 95%  - Guardando en grafo
28:00 - 100% - ✓ Completado
```

---

## 🎯 Ventajas del Sistema

### **Para el Usuario:**

1. ✅ **Transparencia:** Sabe exactamente qué está pasando
2. ✅ **Expectativas:** Sabe cuánto tiempo faltará
3. ✅ **Confianza:** Ve que el sistema está trabajando
4. ✅ **Diagnóstico:** Puede identificar si se trabó en algún punto

### **Para el Desarrollador:**

1. ✅ **Debugging:** Fácil ver dónde falló
2. ✅ **Performance:** Identifica cuellos de botella
3. ✅ **Monitoreo:** Puede alertar si algo tarda demasiado
4. ✅ **Métricas:** Puede medir tiempos promedio

---

## 🔍 Detalles Técnicos Avanzados

### **Optimización de Actualizaciones:**

```typescript
// En lugar de actualizar en cada nodo (lento):
for (const node of nodes) {
  await updateProgress(...);  // ❌ 2000 llamadas
}

// Actualizar por lotes (rápido):
const batchSize = 50;
for (let i = 0; i < nodes.length; i += batchSize) {
  const currentProgress = 48 + ((i / nodes.length) * 2);
  await updateProgress(
    `Guardando índices: ${i + batchSize}/${nodes.length}`,
    currentProgress,
    { saved: i, total: nodes.length }
  );  // ✅ 40 llamadas
}
```

### **Progreso en Documentos Grandes:**

```typescript
// Callback de progreso para pdftotext
const result = await extractTextFromPDFWithPdftotext(
  pdfPath,
  fileSize,
  (progress) => {
    const currentProgress = 30 + (progress.percentage * 0.2);
    updateProgress(
      `Extrayendo texto: ${progress.percentage.toFixed(0)}%`,
      currentProgress,
      { stage: "extracting", extractionProgress: progress }
    );
  }
);
```

---

## 📈 Métricas y Monitoreo

### **Tiempos Promedio por Etapa:**

| Etapa | Pequeño (<50 págs) | Mediano (50-500) | Grande (>500) |
|-------|-------------------|------------------|---------------|
| PageIndex | 15-30s | 1-5 min | 5-30 min |
| Cognee | 1-3 min | 3-10 min | 10-30 min |
| **Total** | **2-4 min** | **4-15 min** | **15-60 min** |

### **Progreso Típico por Tamaño:**

```
Pequeño (45 páginas):
████████████████████████████████████████ 100% (2:34)

Mediano (250 páginas):
████████████████████████████████████████ 100% (8:45)

Grande (2133 páginas - Biblia):
████████████████████████████████████████ 100% (28:12)
```

---

## 🛠️ Solución de Problemas

### **El progreso no se actualiza:**

```bash
# Verificar logs de workers
tail -f /tmp/workers.log | grep "Progress"

# Verificar conexión a BD
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "SELECT id, status, processingProgress FROM \"Document\" LIMIT 1;"
```

### **Progreso se queda trabado:**

```bash
# Verificar si el worker está vivo
ps aux | grep "npm run workers"

# Reiniciar workers
pkill -f "npm run workers"
npm run workers &
```

### **Progreso salta porcentajes:**

```typescript
// Normal en actualizaciones por lotes
// Ejemplo: 48% → 49% → 50% (guardando índices)
// No es bug, es optimización para no saturar BD
```

---

## 🎨 Personalización

### **Cambiar Colores:**

```typescript
// En processing-progress.tsx
const getStageColor = () => {
  if (details?.stage?.includes("error")) return "bg-red-500";
  if (details?.stage?.includes("cognee")) return "bg-purple-500";  // ← Cambiar
  if (details?.stage?.includes("index")) return "bg-blue-500";     // ← Cambiar
  return "bg-indigo-500";
};
```

### **Cambiar Frecuencia de Polling:**

```typescript
// En processing-progress.tsx
const interval = setInterval(fetchProgress, 2000);  // ← Cambiar a 1000 (1s) o 5000 (5s)
```

### **Agregar Más Detalles:**

```typescript
// En updateProgress
await updateProgress(documentId, step, percentage, {
  stage: "extracting",
  extractionProgress: progress,
  memoryUsage: process.memoryUsage(),  // ← Agregar
  estimatedTimeRemaining: calculateETA(),  // ← Agregar
});
```

---

## ✅ Checklist de Implementación

- [x] Campo `processingProgress` en schema
- [x] Endpoint GET/POST `/api/documents/[id]/progress`
- [x] Función `updateProgress` en workers
- [x] Componente `ProcessingProgress` en UI
- [x] Polling automático cada 2s
- [x] Reporte en PageIndex (0-60%)
- [x] Reporte en Cognee (60-100%)
- [x] Actualización por lotes
- [x] Manejo de errores
- [x] Documentación

---

**Documentación creada:** Marzo 2026  
**Versión:** 1.0.0  
**Estado:** ✅ Producción
