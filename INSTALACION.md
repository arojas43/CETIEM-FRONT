# 📖 Guía de Instalación - RAG1

> **Instrucciones completas para instalar y configurar el sistema desde cero**

---

## ⏱️ Tiempo Estimado

- **Instalación completa:** 15-30 minutos
- **Primera prueba:** 5 minutos después de instalar

---

## 📋 Prerrequisitos

### Software Requerido

```bash
# Verificar versiones
node --version      # Debe ser 20+
npm --version       # Debe ser 9+
docker --version    # Debe ser 20+
docker-compose --version  # Debe ser 2+
git --version       # Cualquier versión reciente
```

### Si no tienes algo instalado:

#### Node.js 20+

```bash
# Usando nvm (recomendado)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 20
nvm use 20

# O descarga desde: https://nodejs.org/
```

#### Docker

```bash
# Ubuntu/Debian
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh
sudo usermod -aG docker $USER

# macOS: Descargar desde https://www.docker.com/products/docker-desktop
# Windows: Descargar desde https://www.docker.com/products/docker-desktop
```

---

## 🚀 Instalación Paso a Paso

### Paso 1: Clonar el Repositorio

```bash
# Navegar a directorio de proyectos
cd ~/proyectos

# Clonar repositorio
git clone git@github.com:Cipre-Holding/RAG1.git

# Entrar al directorio
cd RAG1
```

### Paso 2: Instalar Dependencias

```bash
# Instalar dependencias de npm
npm install

# Verificar instalación
ls -la node_modules | head -20
```

### Paso 3: Configurar Variables de Entorno

```bash
# Copiar archivo de ejemplo
cp .env.example .env

# Editar .env con tus credenciales
nano .env

# O usar editor gráfico
code .env  # Si usas VS Code
```

**Mínimo requerido:**

```bash
# Cambiar estas 3 variables como mínimo:
LOCAL_STORAGE_PATH=/ruta/completa/a/uploads
NVIDIA_API_KEY=nvapi-tu-api-key-real
NVIDIA_QA_API_KEY=nvapi-tu-api-key-real
NEXTAUTH_SECRET=genera-uno-nuevo-con-openssl-rand-base64-32
```

### Paso 4: Crear Directorio de Uploads

```bash
# Crear directorio para documentos subidos
mkdir -p uploads
chmod 755 uploads
```

### Paso 5: Iniciar Servicios con Docker

```bash
# Iniciar FalkorDB (grafo)
docker run -d \
  --name falkordb-dev \
  -p 6380:6379 \
  -p 3001:3000 \
  -v $(pwd)/falkordb-data:/var/lib/falkordb/data \
  falkordb/falkordb

# Iniciar Redis (colas)
docker run -d \
  --name redis-dev \
  -p 6379:6379 \
  -v redis_data:/data \
  redis:7-alpine redis-server --appendonly yes

# Verificar que están corriendo
docker ps | grep -E "falkordb|redis"
```

### Paso 6: Inicializar Base de Datos

```bash
# Generar Prisma Client
npm run db:generate

# Crear esquema en PostgreSQL
npm run db:push

# Verificar
npm run db:studio
```

### Paso 7: Iniciar la Aplicación

```bash
# Opción A: Usar script de inicio (recomendado)
./start.sh

# Opción B: Iniciar manualmente
# Terminal 1: Workers
npm run workers

# Terminal 2: Next.js
npm run dev
```

### Paso 8: Verificar Instalación

```bash
# Verificar servicios
docker ps | grep -E "falkordb|redis"

# Verificar Redis
redis-cli ping  # Debe responder: PONG

# Verificar FalkorDB
docker exec falkordb-dev redis-cli ping  # Debe responder: PONG

# Verificar Next.js
curl http://localhost:3000  # Debe devolver HTML
```

---

## ✅ Verificación Final

### 1. Acceder a la Aplicación

```
URL: http://localhost:3000
Email: admin@local.dev
Password: admin123
```

### 2. Subir Documento de Prueba

```
1. Ir a Dashboard → Subir Nuevo Documento
2. Subir un PDF pequeño (<10MB)
3. Esperar procesamiento automático
4. Verificar que cambia a estado "✓ Analizado"
```

### 3. Probar Q&A

```
1. Ir al documento → Preguntar al Documento
2. Preguntar: "¿De qué trata este documento?"
3. Verificar que responde con contexto
```

---

## 🐛 Solución de Problemas Comunes

### Error: "ECONNREFUSED" en Redis

```bash
# Verificar Redis
docker ps | grep redis

# Reiniciar Redis
docker restart redis-dev

# Ver logs
docker logs redis-dev
```

### Error: "Cannot find module '@prisma/client'"

```bash
# Regenerar Prisma Client
npm run db:generate

# Reinstalar dependencias
rm -rf node_modules package-lock.json
npm install
npm run db:generate
```

### Error: "Port 3000 is already in use"

```bash
# Matar proceso en puerto 3000
lsof -ti:3000 | xargs kill -9

# O cambiar puerto en .env
NEXT_PUBLIC_APP_URL=http://localhost:3001
```

### Error: "NVIDIA API Key inválida"

```bash
# Verificar API Key en .env
grep NVIDIA_API_KEY .env

# Probar API Key
curl -X POST https://integrate.api.nvidia.com/v1/chat/completions \
  -H "Authorization: Bearer nvapi-tu-key" \
  -H "Content-Type: application/json" \
  -d '{"model":"meta/llama-3.1-70b-instruct","messages":[{"role":"user","content":"test"}]}'
```

### Error: FalkorDB no inicia

```bash
# Verificar puerto
docker ps | grep 6380

# Ver logs
docker logs falkordb-dev

# Reiniciar
docker restart falkordb-dev
```

---

## 📊 Verificación de Componentes

### PostgreSQL

```bash
PGPASSWORD=password psql -h localhost -U postgres -d cipre_db -c \
  "SELECT table_name FROM information_schema.tables WHERE table_schema = 'certificacion_ia';"
```

**Debe mostrar:**
```
 table_name
-------------
 Document
 PageIndex
 User
 Account
 Session
 ...
```

### FalkorDB

```bash
docker exec falkordb-dev redis-cli GRAPH.QUERY certificacion "RETURN 1"
```

**Debe responder:**
```
1) 1
2) 1
```

### Redis

```bash
redis-cli ping
```

**Debe responder:**
```
PONG
```

### Next.js

```bash
curl http://localhost:3000 | head -20
```

**Debe devolver HTML de Next.js**

---

## 🎯 Prueba de Carga Rápida

```bash
# Subir documento de prueba
curl -X POST http://localhost:3000/api/documents \
  -F "file=@/ruta/a/archivo.pdf" \
  -H "Cookie: next-auth.session-token=..."

# Verificar procesamiento
curl http://localhost:3000/api/documents \
  -H "Cookie: next-auth.session-token=..."
```

---

## 📝 Checklist de Instalación

- [ ] Node.js 20+ instalado
- [ ] Docker instalado y corriendo
- [ ] Repositorio clonado
- [ ] Dependencias instaladas (`npm install`)
- [ ] `.env` configurado con valores reales
- [ ] Directorio `uploads/` creado
- [ ] FalkorDB corriendo en puerto 6380
- [ ] Redis corriendo en puerto 6379
- [ ] Base de datos inicializada (`npm run db:push`)
- [ ] Next.js corriendo en puerto 3000
- [ ] Workers corriendo
- [ ] Login funciona (admin@local.dev / admin123)
- [ ] Subida de documentos funciona
- [ ] Q&A funciona

---

## 🆘 Soporte

Si tienes problemas:

1. **Revisa los logs:**
   ```bash
   tail -f /tmp/workers.log
   docker logs falkordb-dev
   docker logs redis-dev
   ```

2. **Verifica la documentación:**
   - `README.md` - Documentación principal
   - `INICIO_RAPIDO.md` - Guía rápida
   - `TROUBLESHOOTING.md` - Solución de problemas

3. **Crea un issue en GitHub:**
   - Describe el problema
   - Incluye logs relevantes
   - Menciona tu sistema operativo y versiones

---

## 🎉 ¡Instalación Completada!

Ahora tienes el sistema RAG1 funcionando. Siguientes pasos:

1. **Explora la UI:** http://localhost:3000
2. **Sube tu primer documento**
3. **Prueba Q&A con preguntas específicas**
4. **Revisa la documentación de uso en `README.md`**

---

**Última actualización:** Marzo 2026  
**Versión:** 5.0.0
