# 🔄 Procesamiento Manual de Documentos - Guía de Uso

> **Versión:** 2.0.0  
> **Fecha:** Marzo 2026

---

## 🎯 Nueva Funcionalidad

Ahora puedes **procesar manualmente** cada documento de forma individual y **seleccionar el dominio** de análisis de Cognee.

---

## 📋 ¿Cuándo Usar el Procesamiento Manual?

| Escenario | Acción |
|-----------|--------|
| El procesamiento automático falló | ✅ Usar botón "Procesar" |
| El documento está en estado "PENDING" | ✅ Usar botón "Procesar" |
| El documento está en estado "FAILED" | ✅ Usar botón "Procesar" |
| Quieres reprocesar con otro dominio | ✅ Cambiar dominio y "Reprocesar" |
| Los workers no están funcionando | ✅ Usar procesamiento manual |

---

## 🚀 Dos Formas de Procesar

### 1. Desde la Lista de Documentos

**Ubicación:** Dashboard → Documentos

**Pasos:**
1. Ve al Dashboard principal
2. En la lista de documentos, cada documento ahora tiene:
   - **Selector de dominio** (📜 Legal, 🏥 Médico, etc.)
   - **Botón de procesar** (icono de RefreshCw)

3. **Selecciona el dominio** apropiado para tu documento
4. Haz clic en el **botón de procesar** (⚡)
5. Confirma el procesamiento
6. Espera a que se complete (puede tomar varios minutos)

**Ventajas:**
- ✅ Rápido acceso desde la dashboard
- ✅ Cambia el dominio sobre la marcha
- ✅ Procesa múltiples documentos en paralelo

---

### 2. Desde el Detalle del Documento

**Ubicación:** Dashboard → Documentos → [Documento Individual]

**Pasos:**
1. Selecciona un documento de la lista
2. En la página de detalle, verás 4 tarjetas:
   - 🧠 **Procesar Documento** (nueva)
   - 💬 Preguntar al Documento
   - 📄 Ver Contenido
   - 🕸️ Ver Grafo

3. En la tarjeta **"Procesar Documento"**:
   - Selecciona el dominio del dropdown
   - Haz clic en "Procesar" o "Reprocesar"
   - Espera la confirmación

**Ventajas:**
- ✅ Más contexto del documento
- ✅ Ves el resultado inmediatamente
- ✅ Acceso directo a Q&A y Grafo después

---

## 🌍 Dominios Disponibles

| Dominio | Icono | Uso | Entidades que extrae |
|---------|-------|-----|---------------------|
| **📜 Legal** | 📜 | Normas ISO, certificaciones, políticas empresariales | ORGANIZATION, REGULATION, REQUIREMENT, PERSON, DATE, DOCUMENT |
| **🏥 Médico** | 🏥 | Documentos clínicos, procedimientos médicos, estudios | DISEASE, TREATMENT, ANATOMY, MEDICATION, SYMPTOM, DIAGNOSIS |
| **⚙️ Técnico** | ⚙️ | Manuales técnicos, especificaciones, equipos | SYSTEM, EQUIPMENT, SPECIFICATION, MATERIAL, PROCESS, FAILURE |
| **🎓 Académico** | 🎓 | Papers, tesis, investigaciones | CONCEPT, THEORY, METHOD, FINDING, AUTHOR, INSTITUTION |
| **📝 Custom** | 📝 | Documentos genéricos o que no encajan en otros dominios | ENTITY, CONCEPT, OBJECT, PERSON, ORGANIZATION |

---

## 🔄 Flujo de Trabajo Recomendado

### Para Documentos de Certificación (ISO 9001, etc.)

```
1. Subir documento PDF
     ↓
2. Documento aparece en Dashboard con estado "PENDING"
     ↓
3. Seleccionar dominio "📜 Legal" en el dropdown
     ↓
4. Clic en botón "Procesar" (⚡)
     ↓
5. Esperar procesamiento (2-5 minutos)
     ↓
6. Estado cambia a "✓ Analizado"
     ↓
7. Usar "Preguntar al Documento" para consultas
```

### Para Manuales de Procedimientos Médicos

```
1. Subir manual médico PDF
     ↓
2. Seleccionar dominio "🏥 Médico"
     ↓
3. Procesar documento
     ↓
4. Verificar entidades extraídas en "Ver Grafo"
     ↓
5. Hacer preguntas específicas en Q&A
```

---

## 💡 Consejos y Mejores Prácticas

### ✅ Do's

- **Selecciona el dominio correcto** antes de procesar para mejores resultados
- **Espera a que termine** el procesamiento antes de reprocesar
- **Usa Legal** para documentos de certificación empresarial (default)
- **Verifica el grafo** después de procesar para confirmar entidades

### ❌ Don'ts

- **No reproceses** constantemente (espera al menos 1-2 minutos)
- **No cambies el dominio** después de procesado (a menos que quieras reprocesar)
- **No proceses** múltiples documentos grandes simultáneamente (puede saturar)

---

## 🔍 Estados del Documento

| Estado | Significado | Acción |
|--------|-------------|--------|
| **⏳ PENDING** | Esperando procesamiento | Usar botón "Procesar" |
| **⏳ PROCESSING** | Siendo procesado | Esperar |
| **✓ INDEXED** | Texto extraído, sin grafo | Procesar para extraer entidades |
| **✓ ANALYZED** | Completamente procesado | Listo para Q&A |
| **✗ FAILED** | Error en procesamiento | Revisar logs, reprocesar |

---

## 🛠️ Solución de Problemas

### El botón de procesar no responde

```
1. Recargar la página (F5)
2. Verificar que Redis esté corriendo: docker ps | grep redis
3. Si Redis no está, reiniciar: ./start.sh
```

### El procesamiento falla repetidamente

```
1. Verificar logs: tail -f /tmp/workers.log
2. Verificar que FalkorDB esté disponible: docker exec falkordb-dev redis-cli ping
3. Intentar con otro dominio (algunos documentos funcionan mejor con dominios específicos)
4. Usar CLI: npx tsx process-document.ts [ID] legal
```

### El documento queda en estado "PENDING"

```
1. Esperar 1-2 minutos (puede estar en cola)
2. Si persiste, usar botón "Procesar" manualmente
3. Verificar workers: docker ps | grep -E "worker|node"
```

### Cambio de dominio no se refleja

```
1. El cambio de dominio es inmediato
2. Para aplicar el nuevo dominio, debes "Reprocesar"
3. El reprocesamiento sobrescribe el análisis anterior
```

---

## 📊 Ejemplos de Uso

### Ejemplo 1: Norma ISO 9001

```
Documento: "ISO_9001_2015_Quality_Management.pdf"
Dominio: 📜 Legal
Entidades esperadas:
  - REGULATION: ISO 9001, ISO 14001
  - REQUIREMENT: Documentación, auditorías, mejora continua
  - ORGANIZATION: Empresa certificadora
  - PROCEDURE: Procedimientos operativos
```

### Ejemplo 2: Manual de Procedimientos Quirúrgicos

```
Documento: "Procedimientos_Quirurgicos_2024.pdf"
Dominio: 🏥 Médico
Entidades esperadas:
  - PROCEDURE: Laparoscopía, apendicectomía
  - ANATOMY: Apéndice, peritoneo
  - DISEASE: Apendicitis aguda
  - MEDICATION: Antibióticos, anestésicos
```

### Ejemplo 3: Especificación Técnica de Equipos

```
Documento: "Especificaciones_Compresor_Centrifugo.pdf"
Dominio: ⚙️ Técnico
Entidades esperadas:
  - EQUIPMENT: Compresor centrífugo, motor
  - SPECIFICATION: Presión, temperatura, caudal
  - MATERIAL: Acero inoxidable, aleación
  - FAILURE: Sobrecalentamiento, vibración
```

---

## 🎨 Interfaz de Usuario

### Lista de Documentos

```
┌─────────────────────────────────────────────────────────────┐
│  📄 Norma_ISO_9001.pdf                                      │
│     Subido el 10/03/2026                                   │
│                                                             │
│  [📜 Legal ▼]  [⚡ Procesar]  [👁️ Ver]  [✏️]  [🗑️]  [✓ Analizado]│
└─────────────────────────────────────────────────────────────┘
```

### Detalle del Documento

```
┌──────────────────────────────────────────────────────────────┐
│  🧠 Procesar Documento                                       │
│  Ejecuta PageIndex + Cognee manualmente                      │
│                                                              │
│  Dominio de análisis:                                        │
│  [📜 Legal (Normas, ISO)            ▼]                      │
│                                                              │
│  [  🧠 Procesar  ]                                           │
│  El documento no ha sido procesado correctamente             │
└──────────────────────────────────────────────────────────────┘
```

---

## 📈 Métricas de Procesamiento

Después de procesar, verás un resumen:

```
✅ Documento procesado exitosamente!

Entidades: 45
Índices: 128
Tiempo: 127.34s
```

| Métrica | Qué significa |
|---------|---------------|
| **Entidades** | Nodos en el grafo de conocimiento |
| **Índices** | Secciones extraídas por PageIndex |
| **Tiempo** | Duración total del procesamiento |

---

## 🔗 Comandos Relacionados

### Procesar desde CLI

```bash
# Procesar con dominio por defecto (Legal)
npx tsx process-document.ts cmmdpia98000142fp6dz96u2d

# Procesar con dominio específico
npx tsx process-document.ts cmmdpia98000142fp6dz96u2d medical
npx tsx process-document.ts cmmdpia98000142fp6dz96u2d technical
```

### Ver estado en base de datos

```bash
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "SELECT id, name, status, domain FROM \"Document\" ORDER BY \"createdAt\" DESC;"
```

---

**Soporte:** Para más información, consulta `INICIO_RAPIDO.md` o `README.md`
