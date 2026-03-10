# Credenciales para Desarrollo Local

## PostgreSQL (ya existente en Docker)

```bash
# Conexión
Host: localhost
Puerto: 5432
Usuario: postgres
Password: password
Base de datos: cipre_db
Schema: certificacion_ia
```

## Usuario Local para Login

```
Email: admin@local.dev
Password: admin123
```

## NVIDIA NIM

API Key ya configurada en `.env`:
```
NVIDIA_API_KEY=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
```

## Redis (para BullMQ)

Opción 1: Usar Docker temporalmente
```bash
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine
```

Opción 2: Instalar Redis localmente
```bash
sudo apt install redis-server  # Ubuntu/Debian
brew install redis             # macOS
```

## FalkorDB (opcional, para grafos de conocimiento)

```bash
docker run -d --name falkordb-dev -p 6380:6379 falkordb/falkordb:latest
```

Luego actualizar `.env`:
```
FALKORDB_HOST=localhost
FALKORDB_PORT=6380
```

## Comandos de Inicialización

```bash
cd /home/alex/cetiem/certificacion-ia

# 1. Generar Prisma Client
npm run db:generate

# 2. Crear schema en PostgreSQL
npm run db:push

# 3. Iniciar Redis (si no está corriendo)
docker run -d --name redis-dev -p 6379:6379 redis:7-alpine

# 4. Iniciar servidor de desarrollo
npm run dev

# 5. En otra terminal, iniciar workers
npm run workers
```

## Estructura de Archivos Locales

- Documentos subidos: `/home/alex/cetiem/certificacion-ia/uploads/`
- Base de datos: PostgreSQL en Docker (cipre_db)
- Redis: Docker o local
