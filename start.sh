#!/bin/bash
###############################################################################
# CETIEM — Script de Inicio para Desarrolladores
#
# Uso:
#   chmod +x start.sh
#   ./start.sh
#
# Inicia todos los servicios necesarios mediante Docker Compose:
#   PostgreSQL  → localhost:5432
#   Redis       → localhost:6379
#   FalkorDB    → localhost:6380
#   FalkorDB UI → localhost:3001
#   Next.js     → localhost:3000
#   Workers     → proceso background (BullMQ)
###############################################################################

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Directorio del proyecto (relativo al script — funciona desde cualquier ruta)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     CETIEM — Plataforma de Certificación ESG con IA   ║${NC}"
echo -e "${BLUE}║     Iniciando servicios...                             ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

###############################################################################
# 1. Verificar dependencias
###############################################################################
echo -e "${YELLOW}[1/5]${NC} Verificando dependencias..."

if ! command -v docker &>/dev/null; then
  echo -e "${RED}✗ Docker no está instalado. Instálalo desde https://docs.docker.com/get-docker/${NC}"
  exit 1
fi

if ! command -v node &>/dev/null; then
  echo -e "${RED}✗ Node.js no está instalado. Se requiere Node 20+${NC}"
  exit 1
fi

echo -e "${GREEN}✓ Docker y Node.js detectados${NC}"

###############################################################################
# 2. Preparar .env
###############################################################################
echo -e "${YELLOW}[2/5]${NC} Configurando variables de entorno..."

if [ ! -f "$SCRIPT_DIR/.env" ]; then
  if [ -f "$SCRIPT_DIR/.env.example" ]; then
    cp "$SCRIPT_DIR/.env.example" "$SCRIPT_DIR/.env"
    echo -e "${YELLOW}  → .env creado desde .env.example${NC}"
    echo -e "${YELLOW}  → IMPORTANTE: edita .env y agrega tus API keys antes de continuar:${NC}"
    echo -e "${YELLOW}      NVIDIA_API_KEY y NVIDIA_QA_API_KEY → https://build.nvidia.com${NC}"
    echo -e "${YELLOW}      NEXTAUTH_SECRET / AUTH_SECRET → openssl rand -base64 32${NC}"
    echo ""
    # Generar NEXTAUTH_SECRET automáticamente si openssl está disponible
    if command -v openssl &>/dev/null; then
      SECRET=$(openssl rand -base64 32)
      sed -i "s|REEMPLAZA_CON_CLAVE_ALEATORIA|$SECRET|g" "$SCRIPT_DIR/.env" 2>/dev/null || true
      echo -e "${GREEN}  ✓ NEXTAUTH_SECRET generado automáticamente${NC}"
    fi
  else
    echo -e "${RED}✗ No se encontró .env ni .env.example${NC}"
    exit 1
  fi
else
  echo -e "${GREEN}✓ .env existente detectado${NC}"
fi

###############################################################################
# 3. Levantar infraestructura con Docker Compose
###############################################################################
echo -e "${YELLOW}[3/5]${NC} Levantando servicios Docker (PostgreSQL + Redis + FalkorDB)..."

# Liberar puertos si hay conflictos
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

docker compose up -d

echo -e "${GREEN}✓ Contenedores levantados${NC}"
echo ""

# Esperar a que PostgreSQL esté listo
echo -e "${YELLOW}  Esperando PostgreSQL...${NC}"
MAX=30; N=0
until docker exec cetiem-postgres pg_isready -U postgres &>/dev/null || [ $N -ge $MAX ]; do
  N=$((N+1)); sleep 1
done
[ $N -ge $MAX ] && { echo -e "${RED}✗ PostgreSQL no respondió${NC}"; exit 1; }
echo -e "${GREEN}  ✓ PostgreSQL listo${NC}"

# Esperar a que Redis esté listo
echo -e "${YELLOW}  Esperando Redis...${NC}"
MAX=30; N=0
until docker exec cetiem-redis redis-cli ping 2>/dev/null | grep -q PONG || [ $N -ge $MAX ]; do
  N=$((N+1)); sleep 1
done
[ $N -ge $MAX ] && { echo -e "${RED}✗ Redis no respondió${NC}"; exit 1; }
echo -e "${GREEN}  ✓ Redis listo${NC}"

# Esperar a que FalkorDB esté listo
echo -e "${YELLOW}  Esperando FalkorDB...${NC}"
MAX=30; N=0
until docker exec cetiem-falkordb redis-cli ping 2>/dev/null | grep -q PONG || [ $N -ge $MAX ]; do
  N=$((N+1)); sleep 1
done
[ $N -ge $MAX ] && { echo -e "${RED}✗ FalkorDB no respondió${NC}"; exit 1; }
echo -e "${GREEN}  ✓ FalkorDB listo${NC}"
echo ""

###############################################################################
# 4. Instalar dependencias y preparar BD
###############################################################################
echo -e "${YELLOW}[4/5]${NC} Preparando base de datos..."

# Instalar dependencias si hace falta
if [ ! -d "$SCRIPT_DIR/node_modules" ]; then
  echo "  Instalando dependencias npm..."
  npm install
fi

npm run db:generate > /dev/null 2>&1
npm run db:push     > /dev/null 2>&1
npx prisma db seed  > /dev/null 2>&1 || echo -e "${YELLOW}  ⚠ Seed ya ejecutado o falló (no es crítico)${NC}"

echo -e "${GREEN}✓ Base de datos lista${NC}"
echo ""

###############################################################################
# 5. Iniciar Next.js + Workers
###############################################################################
echo -e "${YELLOW}[5/5]${NC} Iniciando aplicación..."

# Limpiar build anterior para evitar errores de caché
rm -rf "$SCRIPT_DIR/.next" 2>/dev/null || true

# Cleanup al salir
cleanup() {
  echo ""
  echo -e "${YELLOW}Deteniendo workers...${NC}"
  [ -n "$WORKERS_PID" ] && kill "$WORKERS_PID" 2>/dev/null || true
  echo -e "${GREEN}✓ Workers detenidos. Los contenedores Docker siguen corriendo.${NC}"
  echo -e "${YELLOW}  Para detenerlos: docker compose down${NC}"
}
trap cleanup EXIT INT TERM

# Workers en background
(cd "$SCRIPT_DIR" && npm run workers 2>&1 | sed 's/^/  [Workers] /') &
WORKERS_PID=$!

sleep 2

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Todos los servicios están corriendo                ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Infraestructura (Docker):                             ║${NC}"
echo -e "${GREEN}║    PostgreSQL  → localhost:5432                        ║${NC}"
echo -e "${GREEN}║    Redis       → localhost:6379                        ║${NC}"
echo -e "${GREEN}║    FalkorDB    → localhost:6380                        ║${NC}"
echo -e "${GREEN}║    FalkorDB UI → http://localhost:3001                 ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Aplicación:                                           ║${NC}"
echo -e "${GREEN}║    http://localhost:3000                               ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Usuarios de prueba (todos: cetiem2024):               ║${NC}"
echo -e "${GREEN}║    admin@cetiem.mx      → Super Admin                  ║${NC}"
echo -e "${GREEN}║    assessor@cetiem.mx   → Data Assessor                ║${NC}"
echo -e "${GREEN}║    empresa1@cetiem.mx   → Empresa Track A              ║${NC}"
echo -e "${GREEN}║    empresa2@cetiem.mx   → Empresa Track B              ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Ctrl+C para detener Next.js y Workers                 ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Next.js en foreground
cd "$SCRIPT_DIR"
npm run dev
