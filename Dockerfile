# ============================================================
# CETIEM — Dockerfile multi-stage
# ============================================================

# ── Stage 1: Dependencias del sistema + npm install ──────────
FROM node:20-slim AS deps
WORKDIR /app

# Libs del sistema para módulos nativos (canvas, pdfjs, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev \
    && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
# Instala TODAS las deps (incluyendo dev: tsx, prisma CLI)
RUN npm ci

# ── Stage 2: Build de Next.js ─────────────────────────────────
FROM node:20-slim AS builder
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Generar Prisma Client para el OS del contenedor
RUN npx prisma generate

# Variables públicas necesarias en build time
ENV NEXT_TELEMETRY_DISABLED=1
ENV NEXT_PUBLIC_APP_URL=http://localhost:3000

RUN npm run build

# ── Stage 3: Runner final ─────────────────────────────────────
FROM node:20-slim AS runner
WORKDIR /app

# Solo libs de RUNTIME (no dev tools)
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 libpango-1.0-0 libpangocairo-1.0-0 \
    libjpeg62-turbo libgif7 librsvg2-2 \
    && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Directorio para PDFs subidos (montado como volumen)
RUN mkdir -p /app/uploads

# Artefactos del build
COPY --from=builder /app/.next          ./.next
COPY --from=builder /app/public         ./public
COPY --from=builder /app/package.json   ./package.json
COPY --from=builder /app/next.config.js ./next.config.js

# Prisma (schema + cliente generado)
COPY --from=builder /app/prisma         ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma

# node_modules completos (incluye tsx para workers + prisma CLI para db-init)
COPY --from=builder /app/node_modules   ./node_modules

# Código fuente TypeScript (workers lo necesitan via tsx)
COPY --from=builder /app/src            ./src
COPY --from=builder /app/tsconfig.json  ./tsconfig.json

EXPOSE 3000

# Comando por defecto: servidor Next.js de producción
CMD ["npm", "start"]
