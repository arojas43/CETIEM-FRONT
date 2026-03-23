#!/bin/bash

###############################################################################
# Script de Inicio - Sistema de Certificación con IA
# 
# Este script inicia todos los servicios necesarios:
# 1. FalkorDB (grafo de conocimiento) - Puerto 6380
# 2. Redis (colas BullMQ) - Puerto 6379
# 3. Next.js (servidor web) - Puerto 3000
# 4. Workers (procesamiento background)
###############################################################################

set -e

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directorio del proyecto
PROJECT_DIR="/home/alex/cetiem/certificacion-ia"
DATA_DIR="/home/alex/cetiem/falkordb-data"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Sistema de Certificación Empresarial con IA          ║${NC}"
echo -e "${BLUE}║  Iniciando servicios...                                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Función para verificar si un contenedor existe
container_exists() {
    docker ps -a --format '{{.Names}}' | grep -q "^$1$"
}

# Función para verificar si un contenedor está corriendo
container_running() {
    docker ps --format '{{.Names}}' | grep -q "^$1$"
}

###############################################################################
# 1. Crear directorio de datos para FalkorDB
###############################################################################
echo -e "${YELLOW}[1/6]${NC} Creando directorio de datos..."
mkdir -p "$DATA_DIR"
echo -e "${GREEN}✓ Directorio creado: $DATA_DIR${NC}"
echo ""

###############################################################################
# 2. Iniciar FalkorDB (puerto 6380 para no conflictar con Redis)
###############################################################################
echo -e "${YELLOW}[2/6]${NC} Iniciando FalkorDB..."

if container_running "falkordb-dev"; then
    echo -e "${GREEN}✓ FalkorDB ya está corriendo${NC}"
else
    if container_exists "falkordb-dev"; then
        echo "  Eliminando contenedor detenido..."
        docker rm falkordb-dev > /dev/null 2>&1
    fi
    
    docker run -d \
        --name falkordb-dev \
        -p 6380:6379 \
        -p 3001:3000 \
        -v "$DATA_DIR:/var/lib/falkordb/data" \
        falkordb/falkordb --stop-writes-on-bgsave-error no > /dev/null 2>&1
    
    # Esperar a que FalkorDB esté listo
    echo "  Esperando a que FalkorDB esté listo..."
    sleep 3
    
    if container_running "falkordb-dev"; then
        echo -e "${GREEN}✓ FalkorDB iniciado en puerto 6380${NC}"
        echo -e "  ${BLUE}UI Web: http://localhost:3001${NC}"
    else
        echo -e "${RED}✗ Error al iniciar FalkorDB${NC}"
        exit 1
    fi
fi
echo ""

###############################################################################
# 3. Iniciar Redis para BullMQ
###############################################################################
echo -e "${YELLOW}[3/6]${NC} Iniciando Redis..."

if container_running "redis-dev"; then
    echo -e "${GREEN}✓ Redis ya está corriendo${NC}"
else
    if container_exists "redis-dev"; then
        echo "  Eliminando contenedor detenido..."
        docker rm redis-dev > /dev/null 2>&1
    fi

    docker run -d \
        --name redis-dev \
        -p 6379:6379 \
        -v redis_data:/data \
        redis:7-alpine redis-server --appendonly yes > /dev/null 2>&1

    sleep 2

    if container_running "redis-dev"; then
        echo -e "${GREEN}✓ Redis iniciado en puerto 6379${NC}"
    else
        echo -e "${RED}✗ Error al iniciar Redis${NC}"
        exit 1
    fi
fi

# Esperar a que Redis esté aceptando conexiones
echo -e "${YELLOW}  Verificando que Redis esté listo...${NC}"
MAX_RETRIES=30
RETRY_COUNT=0
while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    # Usar docker exec para verificar Redis dentro del contenedor
    if docker exec redis-dev redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}  ✓ Redis está listo y aceptando conexiones${NC}"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -e "${YELLOW}  Intento $RETRY_COUNT/$MAX_RETRIES - Esperando Redis...${NC}"
    sleep 1
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo -e "${RED}✗ Redis no respondió después de $MAX_RETRIES intentos${NC}"
    echo -e "${YELLOW}  Verifica que Docker esté corriendo: docker ps${NC}"
    exit 1
fi
echo ""

###############################################################################
# 4. Actualizar .env con puertos correctos
###############################################################################
echo -e "${YELLOW}[4/6]${NC} Configurando variables de entorno..."

# Limpiar puertos ocupados
echo "  Limpiando puertos..."
lsof -ti:3000 | xargs kill -9 2>/dev/null || true
lsof -ti:3002 | xargs kill -9 2>/dev/null || true

# Limpieza completa de build anterior
echo "  Limpiando directorios temporales..."
rm -rf "$PROJECT_DIR/.next"
rm -rf "$PROJECT_DIR/node_modules/.cache"
rm -rf "$PROJECT_DIR/.turbo"

cat > "$PROJECT_DIR/.env" << 'EOF'
# Next.js
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Database (PostgreSQL - Docker existente)
DATABASE_URL="postgresql://postgres:password@localhost:5432/cipre_db?schema=certificacion_ia"

# Almacenamiento Local
LOCAL_STORAGE_PATH=/home/alex/cetiem/certificacion-ia/uploads

# NextAuth
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=desarrollo-local-secret-key-12345

# NVIDIA NIM (chat + embeddings)
NVIDIA_API_KEY=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
NVIDIA_EMBEDDING_MODEL=llama-3_2-nemoretriever-300m-embed-v1
NVIDIA_CHAT_MODEL=meta/llama-3.1-70b-instruct

# NVIDIA QA (Qwen 3.5 122B — key dedicada)
NVIDIA_QA_API_KEY=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

# Redis (puerto 6379)
REDIS_HOST=localhost
REDIS_PORT=6379

# PageIndex (local)
PAGEINDEX_LOCAL_MODE=true

# Cognee + FalkorDB (puerto 6380)
COGNEE_MODE=falkordb
COGNEE_LLM_PROVIDER=nvidia
COGNEE_EMBEDDING_PROVIDER=nvidia
FALKORDB_HOST=localhost
FALKORDB_PORT=6380

# Límites de procesamiento
MAX_CHUNKS_TO_PROCESS=500
MAX_BATCHES=100
EOF

echo -e "${GREEN}✓ .env configurado${NC}"
echo ""

###############################################################################
# 5. Inicializar Base de Datos (Prisma)
###############################################################################
echo -e "${YELLOW}[5/6]${NC} Inicializando base de datos..."

cd "$PROJECT_DIR"

npm run db:generate > /dev/null 2>&1
npm run db:push > /dev/null 2>&1

echo -e "${GREEN}✓ Base de datos inicializada${NC}"
echo ""

###############################################################################
# 6. Iniciar Servidor Next.js y Workers
###############################################################################
echo -e "${YELLOW}[6/6]${NC} Iniciando servicios de la aplicación..."
echo ""

# Verificar que FalkorDB esté listo antes de continuar
echo -e "${YELLOW}  Verificando que FalkorDB esté listo...${NC}"
FALKOR_RETRIES=20
FALKOR_COUNT=0
while [ $FALKOR_COUNT -lt $FALKOR_RETRIES ]; do
    if docker exec falkordb-dev redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}  ✓ FalkorDB está listo${NC}"
        break
    fi
    FALKOR_COUNT=$((FALKOR_COUNT + 1))
    echo -e "${YELLOW}  Intento $FALKOR_COUNT/$FALKOR_RETRIES - Esperando FalkorDB...${NC}"
    sleep 1
done

if [ $FALKOR_COUNT -eq $FALKOR_RETRIES ]; then
    echo -e "${RED}✗ FalkorDB no respondió después de $FALKOR_RETRIES intentos${NC}"
    exit 1
fi

# Verificar que Redis esté accesible desde la aplicación
echo -e "${YELLOW}  Verificando conectividad Redis para workers...${NC}"
if docker exec redis-dev redis-cli ping 2>/dev/null | grep -q "PONG"; then
    echo -e "${GREEN}  ✓ Redis accesible para workers${NC}"
else
    echo -e "${RED}✗ Redis no está accesible${NC}"
    exit 1
fi

# Crear script temporal para iniciar workers en background con retry
cat > /tmp/start_workers.sh << 'WORKERS'
#!/bin/bash
cd /home/alex/cetiem/certificacion-ia

# Función para verificar Redis desde Docker
check_redis() {
    docker exec redis-dev redis-cli ping 2>/dev/null | grep -q "PONG"
}

# Esperar a que Redis esté disponible (reintentos)
echo "🔧 Workers iniciando... verificando Redis"
WORKER_RETRIES=10
WORKER_COUNT=0
while [ $WORKER_COUNT -lt $WORKER_RETRIES ]; do
    if check_redis; then
        echo "✅ Redis disponible, iniciando workers..."
        break
    fi
    WORKER_COUNT=$((WORKER_COUNT + 1))
    echo "⏳ Esperando Redis (intento $WORKER_COUNT/$WORKER_RETRIES)..."
    sleep 2
done

if [ $WORKER_COUNT -eq $WORKER_RETRIES ]; then
    echo "❌ Redis no disponible después de $WORKER_RETRIES intentos"
    exit 1
fi

# Iniciar workers
npm run workers 2>&1 | while read line; do
    echo "  [Workers] $line"
done
WORKERS

chmod +x /tmp/start_workers.sh

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Todos los servicios están corriendo                ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Servicios:                                            ║${NC}"
echo -e "${GREEN}║    • FalkorDB:  puerto 6380 (UI: http://localhost:3001)${NC}"
echo -e "${GREEN}║    • Redis:     puerto 6379                           ║${NC}"
echo -e "${GREEN}║    • Next.js:   puerto 3000                           ║${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}║  Credenciales:                                         ║${NC}"
echo -e "${GREEN}║    Email:    admin@local.dev                          ║${NC}"
echo -e "${GREEN}║    Password: admin123                                 ║${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}║  URLs:                                                 ║${NC}"
echo -e "${GREEN}║    • App:      http://localhost:3000                  ║${NC}"
echo -e "${GREEN}║    • FalkorDB: http://localhost:3001                  ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Para detener los servicios:                           ║${NC}"
echo -e "${GREEN}║    docker stop falkordb-dev redis-dev                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Iniciar Next.js en foreground y workers en background
echo -e "${BLUE}🚀 Iniciando Next.js...${NC}"
echo ""

# Iniciar workers en segundo plano
/tmp/start_workers.sh &
WORKERS_PID=$!

# Esperar 2 segundos para que los workers inicien
sleep 2

echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Todos los servicios están corriendo                ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Servicios:                                            ║${NC}"
echo -e "${GREEN}║    • FalkorDB:  puerto 6380 (UI: http://localhost:3001)${NC}"
echo -e "${GREEN}║    • Redis:     puerto 6379                           ║${NC}"
echo -e "${GREEN}║    • Next.js:   puerto 3000                           ║${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}║  Credenciales:                                         ║${NC}"
echo -e "${GREEN}║    Email:    admin@local.dev                          ║${NC}"
echo -e "${GREEN}║    Password: admin123                                 ║${NC}"
echo -e "${GREEN}║                                                        ║${NC}"
echo -e "${GREEN}║  URLs:                                                 ║${NC}"
echo -e "${GREEN}║    • App:      http://localhost:3000                  ║${NC}"
echo -e "${GREEN}║    • FalkorDB: http://localhost:3001                  ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Presiona Ctrl+C para detener                         ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${YELLOW}Abre tu navegador en: http://localhost:3000${NC}"
echo ""

# Cleanup al salir (debe registrarse ANTES del exec/npm run dev)
cleanup() {
    echo ""
    echo -e "${YELLOW}Deteniendo workers...${NC}"
    kill $WORKERS_PID 2>/dev/null || true
    echo -e "${GREEN}✓ Servicios detenidos${NC}"
}
trap cleanup EXIT INT TERM

# Iniciar Next.js en primer plano (MODO DESARROLLO, SIN BUILD)
cd "$PROJECT_DIR"
npm run dev
