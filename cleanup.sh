#!/bin/bash

###############################################################################
# Script de Limpieza - Sistema de Certificación con IA
# 
# Este script elimina archivos innecesarios generados durante el desarrollo
# y mantiene solo lo esencial para producción.
#
# Uso: ./cleanup.sh
###############################################################################

set -e

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  Limpieza de Archivos Innecesarios                    ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Contador de espacio liberado
TOTAL_FREED=0

# Función para calcular tamaño de directorio
get_size() {
    du -sh "$1" 2>/dev/null | cut -f1
}

# 1. Limpieza de build de Next.js
echo -e "${YELLOW}[1/6]${NC} Limpiando build de Next.js..."
if [ -d ".next" ]; then
    SIZE=$(get_size ".next")
    rm -rf .next
    echo -e "${GREEN}   ✓ Eliminado: .next ($SIZE)${NC}"
fi

# 2. Limpieza de cache de TypeScript
echo -e "${YELLOW}[2/6]${NC} Eliminando archivos de build de TypeScript..."
TS_FILES=$(find . -maxdepth 1 -name "*.tsbuildinfo" 2>/dev/null)
if [ -n "$TS_FILES" ]; then
    rm -f *.tsbuildinfo
    echo -e "${GREEN}   ✓ Eliminado: *.tsbuildinfo${NC}"
fi

# 3. Limpieza de archivos de documentación obsoleta
echo -e "${YELLOW}[3/6]${NC} Identificando documentación obsoleta..."

# Archivos de documentación que pueden eliminarse (son de debugging/estado anterior)
OBSOLETE_DOCS=(
    "ESTADO_ACTUAL_SISTEMA.md"
    "ERROR_SUBIDA.md"
    "TROUBLESHOOTING_WORKERS.md"
    "REINICIAR_WORKERS.md"
    "SOLUCION_UI.md"
    "VERIFICACION_UI_FINAL.md"
    "SISTEMA_VERIFICADO.md"
    "INTEGRACION_CORRECTA.md"
    "PAGEINDEX_COGnee_REAL.md"
    "IMPLEMENTACION_FASE1.md"
    "IMPLEMENTACION_COMPLETA.md"
    "AUDITORIA_COMPLETA.md"
    "GRAFOS_INDIVIDUALES.md"
    "REPROCESAR_ENZINGER.md"
    "DOCUMENTOS_GRANDES_2GB.md"
    "OCR_IMPLEMENTACION.md"
)

DELETED_COUNT=0
for doc in "${OBSOLETE_DOCS[@]}"; do
    if [ -f "$doc" ]; then
        SIZE=$(stat -c%s "$doc" 2>/dev/null || echo "0")
        rm -f "$doc"
        echo -e "${GREEN}   ✓ Eliminado: $doc${NC}"
        DELETED_COUNT=$((DELETED_COUNT + 1))
        TOTAL_FREED=$((TOTAL_FREED + SIZE))
    fi
done

echo -e "${GREEN}   Total docs eliminados: $DELETED_COUNT${NC}"

# 4. Scripts de debugging que ya no son necesarios
echo -e "${YELLOW}[4/6]${NC} Eliminando scripts de debugging obsoletos..."

OBSOLETE_SCRIPTS=(
    "create-chunks-manual.cjs"
    "test-queue-job.js"
    "test-upload.sh"
    "diagnostico.sh"
    "force-analysis.sh"
    "force-process-document.js"
    "process-documents-direct.js"
    "rebuild-all-graphs.sh"
    "reprocess-document.sh"
    "restart-workers.sh"
    "start-improved.sh"
    "stop.sh"
)

for script in "${OBSOLETE_SCRIPTS[@]}"; do
    if [ -f "$script" ]; then
        rm -f "$script"
        echo -e "${GREEN}   ✓ Eliminado: $script${NC}"
    fi
done

# 5. PDFs de prueba en raíz (opcional, comentar si se quieren conservar)
echo -e "${YELLOW}[5/6]${NC} Verificando PDFs de prueba en raíz..."
if [ -f "articulo1.pdf" ]; then
    echo -e "${YELLOW}   ⚠️  Encontrado: articulo1.pdf${NC}"
    echo -e "${YELLOW}      ¿Conservar? (este archivo es de prueba)${NC}"
    # No lo eliminamos automáticamente, el usuario decide
fi

# 6. Limpieza de node_modules (opcional, descomentar si se quiere hacer)
# echo -e "${YELLOW}[6/6]${NC} Limpiando node_modules (se reinstalarán con npm install)..."
# if [ -d "node_modules" ]; then
#     SIZE=$(get_size "node_modules")
#     rm -rf node_modules
#     echo -e "${GREEN}   ✓ Eliminado: node_modules ($SIZE)${NC}"
# fi

echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  ✓ Limpieza Completada                                 ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Archivos eliminados:                                  ║${NC}"
echo -e "${GREEN}║    • Build de Next.js (.next)                          ║${NC}"
echo -e "${GREEN}║    • Cache TypeScript (*.tsbuildinfo)                  ║${NC}"
echo -e "${GREEN}║    • Documentación obsoleta (${DELETED_COUNT} archivos)            ║${NC}"
echo -e "${GREEN}║    • Scripts de debugging (12 archivos)                ║${NC}"
echo -e "${GREEN}╠════════════════════════════════════════════════════════╣${NC}"
echo -e "${GREEN}║  Archivos esenciales conservados:                      ║${NC}"
echo -e "${GREEN}║    ✓ README.md                                         ║${NC}"
echo -e "${GREEN}║    ✓ INICIO_RAPIDO.md                                  ║${NC}"
echo -e "${GREEN}║    ✓ CREDENCIALES_LOCALES.md                           ║${NC}"
echo -e "${GREEN}║    ✓ MEJORAS_IMPLEMENTADAS_2026.md                     ║${NC}"
echo -e "${GREEN}║    ✓ start.sh                                          ║${NC}"
echo -e "${GREEN}║    ✓ process-document.ts                               ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════╝${NC}"
echo ""

# Calcular espacio liberado aproximado
if command -v du &> /dev/null; then
    echo -e "${BLUE}💾 Espacio liberado estimado: ${TOTAL_FREED} bytes${NC}"
fi

echo ""
echo -e "${YELLOW}Nota: Los archivos eliminados eran de debugging/desarrollo${NC}"
echo -e "${YELLOW}      El sistema funciona correctamente sin ellos.${NC}"
echo ""
