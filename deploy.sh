#!/usr/bin/env bash
# ============================================================
# deploy.sh — Despliegue de frontend a Cloud Run
#
# Prerrequisitos:
#   1. gcloud CLI instalado y autenticado (gcloud auth login)
#   2. Docker instalado
#   3. Cloudflare Tunnel corriendo en la máquina local
#
# Uso:
#   ./deploy.sh                    → primer deploy (obtiene URL)
#   BACKEND_URL=https://xyz.trycloudflare.com ./deploy.sh  → deploy completo
# ============================================================

set -euo pipefail

# ── Configuración ─────────────────────────────────────────────
PROJECT_ID="${GCP_PROJECT:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${GCP_REGION:-us-central1}"
SERVICE_NAME="certificacion-ia"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "ERROR: Set GCP_PROJECT or run: gcloud config set project YOUR_PROJECT_ID"
  exit 1
fi

echo "Project: $PROJECT_ID | Region: $REGION | Service: $SERVICE_NAME"

# ── Paso 1: Obtener o usar URL del servicio ───────────────────
SERVICE_URL="${NEXT_PUBLIC_APP_URL:-}"
if [[ -z "$SERVICE_URL" ]]; then
  # Intentar obtener URL del servicio existente
  SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" \
    --region="$REGION" --format="value(status.url)" 2>/dev/null || true)
fi

if [[ -z "$SERVICE_URL" ]]; then
  echo "⚠  No se conoce la URL del servicio aún."
  echo "   Se hará un primer deploy sin BACKEND_URL para obtenerla."
  echo "   Después corre: BACKEND_URL=https://tu-tunnel.trycloudflare.com ./deploy.sh"
  SERVICE_URL="http://localhost:3001"
fi

echo "Service URL: $SERVICE_URL"
BACKEND_URL="${BACKEND_URL:-}"

# ── Paso 2: Build de la imagen ────────────────────────────────
echo ""
echo "🔨 Building Docker image..."
docker build \
  -f Dockerfile.cloudrun \
  --build-arg "NEXT_PUBLIC_APP_URL=${SERVICE_URL}" \
  -t "${IMAGE}:latest" .

# ── Paso 3: Push a Container Registry ────────────────────────
echo ""
echo "📦 Pushing to gcr.io..."
docker push "${IMAGE}:latest"

# ── Paso 4: Deploy a Cloud Run ────────────────────────────────
echo ""
echo "🚀 Deploying to Cloud Run..."

ENV_VARS="NEXTAUTH_URL=${SERVICE_URL}"
ENV_VARS="${ENV_VARS},NEXT_PUBLIC_APP_URL=${SERVICE_URL}"
ENV_VARS="${ENV_VARS},NEXTAUTH_SECRET=${NEXTAUTH_SECRET:-secretaria-economia-dev-secret}"
ENV_VARS="${ENV_VARS},AUTH_SECRET=${AUTH_SECRET:-secretaria-economia-dev-secret}"
ENV_VARS="${ENV_VARS},NODE_ENV=production"

if [[ -n "$BACKEND_URL" ]]; then
  ENV_VARS="${ENV_VARS},BACKEND_URL=${BACKEND_URL}"
  echo "   BACKEND_URL: $BACKEND_URL"
else
  echo "   ⚠  BACKEND_URL no seteado — las rutas /api/* no funcionarán hasta que lo configures."
fi

gcloud run deploy "$SERVICE_NAME" \
  --image="${IMAGE}:latest" \
  --region="$REGION" \
  --platform=managed \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=3 \
  --timeout=300 \
  --set-env-vars="$ENV_VARS"

# ── Paso 5: Mostrar URL final ─────────────────────────────────
echo ""
FINAL_URL=$(gcloud run services describe "$SERVICE_NAME" \
  --region="$REGION" --format="value(status.url)")
echo "✅ Desplegado en: $FINAL_URL"

if [[ -z "$BACKEND_URL" ]]; then
  echo ""
  echo "─────────────────────────────────────────────────────"
  echo "SIGUIENTE PASO:"
  echo "1. En tu máquina local, instala cloudflared:"
  echo "   brew install cloudflare/cloudflare/cloudflared"
  echo "   # o: curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg"
  echo ""
  echo "2. Levanta el backend local:"
  echo "   docker compose up -d"
  echo ""
  echo "3. Expón el backend con Cloudflare Tunnel:"
  echo "   cloudflared tunnel --url http://localhost:3001"
  echo "   # Obtendrás algo como: https://random-word.trycloudflare.com"
  echo ""
  echo "4. Redespliega con el BACKEND_URL:"
  echo "   BACKEND_URL=https://random-word.trycloudflare.com \\"
  echo "   NEXT_PUBLIC_APP_URL=${FINAL_URL} \\"
  echo "   ./deploy.sh"
  echo "─────────────────────────────────────────────────────"
fi
