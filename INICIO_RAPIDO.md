# 🚀 Guía Rápida de Inicio - Sistema de Certificación con IA

> **Versión:** 2.0.0 (Mejorada 2026)  
> **Última actualización:** Marzo 2026

---

## ⚡ Inicio Rápido (3 pasos)

### 1. Iniciar el Sistema

```bash
cd /home/alex/cetiem/certificacion-ia
./start.sh
```

**Esto inicia automáticamente:**
- ✅ FalkorDB (grafo de conocimiento) - Puerto 6380
- ✅ Redis (colas BullMQ) - Puerto 6379
- ✅ Next.js (servidor web) - Puerto 3000
- ✅ Workers (procesamiento automático)

---

### 2. Abrir la Aplicación

```
http://localhost:3000
```

**Credenciales por defecto:**
- **Email:** `admin@local.dev`
- **Password:** `admin123`

---

### 3. Subir un Documento

1. Haz clic en **"Subir Nuevo Documento"**
2. Arrastra tu archivo PDF o haz clic para seleccionar
3. El sistema procesará automáticamente el documento

---

## 📋 Comandos Útiles

### Procesar Documento Manualmente

Si un documento queda pendiente de procesamiento:

```bash
# Con dominio por defecto (legal para certificaciones)
npx tsx process-document.ts [ID_DEL_DOCUMENTO]

# Con dominio específico
npx tsx process-document.ts [ID] legal
npx tsx process-document.ts [ID] medical
npx tsx process-document.ts [ID] technical
```

### Ver Estado de Documentos

```bash
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "SELECT id, name, status FROM \"Document\" ORDER BY \"createdAt\" DESC;"
```

### Verificar Servicios

```bash
# Redis
redis-cli ping  # Debe responder: PONG

# FalkorDB
docker exec falkordb-dev redis-cli ping  # Debe responder: PONG

# Ver contenedores
docker ps | grep -E "falkordb|redis"
```

### Reiniciar Servicios

```bash
# Detener todo
docker stop falkordb-dev redis-dev

# Volver a iniciar
./start.sh
```

---

## 🛠️ Limpieza del Proyecto

Para eliminar archivos innecesarios de debugging:

```bash
./cleanup.sh
```

**Esto elimina:**
- Build anterior de Next.js (`.next`)
- Cache de TypeScript (`*.tsbuildinfo`)
- Documentación obsoleta (16 archivos)
- Scripts de debugging (12 archivos)

---

## 📊 Dominios Disponibles

| Dominio | Uso | Ejemplo |
|---------|-----|---------|
| `legal` | Normas ISO, certificaciones, políticas | `npx tsx process-document.ts [ID] legal` |
| `medical` | Documentos clínicos, procedimientos médicos | `npx tsx process-document.ts [ID] medical` |
| `technical` | Manuales técnicos, especificaciones | `npx tsx process-document.ts [ID] technical` |
| `academic` | Papers, tesis, investigaciones | `npx tsx process-document.ts [ID] academic` |
| `custom` | Documentos genéricos | `npx tsx process-document.ts [ID] custom` |

---

## 🔍 URLs de Servicios

| Servicio | URL | Puerto |
|----------|-----|--------|
| **Aplicación Web** | http://localhost:3000 | 3000 |
| **FalkorDB UI** | http://localhost:3001 | 6380 |
| **Redis** | localhost:6379 | 6379 |
| **PostgreSQL** | localhost:5432 | 5432 |

---

## 🐛 Solución de Problemas

### Los Workers No Inician

```bash
# Verificar Redis
docker ps | grep redis
redis-cli ping

# Si Redis no responde:
docker restart redis-dev
./start.sh
```

### FalkorDB No Disponible

```bash
# Verificar contenedor
docker ps | grep falkordb

# Reiniciar:
docker restart falkordb-dev
```

### Documento No Se Procesa

```bash
# 1. Verificar estado
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "SELECT id, name, status FROM \"Document\" WHERE id = '[ID]';"

# 2. Procesar manualmente
npx tsx process-document.ts [ID] legal

# 3. Ver logs de workers
tail -f /tmp/start_workers.sh.log 2>/dev/null
```

### Error de Puertos Ocupados

```bash
# Liberar puertos
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3001 | xargs kill -9 2>/dev/null || true
lsof -ti:6379 | xargs kill -9 2>/dev/null || true

# Volver a iniciar
./start.sh
```

---

## 📁 Estructura del Proyecto

```
certificacion-ia/
├── src/
│   ├── app/              # Next.js App Router
│   ├── lib/              # Lógica de negocio
│   │   ├── queue/        # Workers BullMQ
│   │   ├── pageindex-*.ts # PageIndex service
│   │   ├── cognee-*.ts   # Cognee service
│   │   └── falkordb.ts   # FalkorDB client
│   └── components/       # Componentes React
├── prisma/               # Schema de base de datos
├── uploads/              # Documentos subidos
├── start.sh              # Script de inicio
├── process-document.ts   # Procesamiento manual
└── cleanup.sh            # Limpieza
```

---

## 🎯 Flujo de Trabajo

```
1. ./start.sh
       ↓
2. http://localhost:3000
       ↓
3. Login (admin@local.dev / admin123)
       ↓
4. Subir PDF
       ↓
5. Procesamiento automático:
   - PageIndex (estructura)
   - Cognee (entidades)
   - FalkorDB (grafo)
       ↓
6. Ver resultados:
   - Contenido extraído
   - Grafo de conocimiento
   - Q&A sobre documento
```

---

## 📚 Documentación Adicional

- **MEJORAS_IMPLEMENTADAS_2026.md** - Mejoras realizadas
- **CREDENCIALES_LOCALES.md** - Credenciales de acceso
- **ARQUITECTURA.md** - Diagramas de arquitectura
- **README.md** - Documentación principal

---

## ✅ Checklist de Verificación

Antes de usar el sistema, verifica:

- [ ] Docker está corriendo (`docker ps`)
- [ ] Puertos disponibles (3000, 3001, 5432, 6379, 6380)
- [ ] Variables de entorno configuradas (`.env`)
- [ ] PostgreSQL accesible
- [ ] Redis responde (`redis-cli ping`)
- [ ] FalkorDB responde (`docker exec falkordb-dev redis-cli ping`)

---

**Soporte:** Revisar logs en `/tmp/workers.log` y consola de Next.js
