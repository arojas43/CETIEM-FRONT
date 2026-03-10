# 📋 Hoja de Referencia Rápida - Equipo de Desarrollo

---

## ⚡ Comandos Esenciales

```bash
# INICIAR TODO (mañana o primer uso)
./start.sh

# DETENER TODO (fin del día)
./stop.sh

# Ver estado de servicios
docker ps

# Ver logs en vivo
docker logs -f falkordb-dev
docker logs -f redis-dev
```

---

## 🌐 URLs de Acceso

| Servicio | URL | Credenciales |
|----------|-----|--------------|
| **App** | http://localhost:3000 | admin@local.dev / admin123 |
| **FalkorDB** | http://localhost:3001 | - |

---

## 🔌 Puertos

| Puerto | Servicio | Comando para verificar |
|--------|----------|----------------------|
| 3000 | Next.js | `lsof -i :3000` |
| 3001 | FalkorDB UI | `lsof -i :3001` |
| 6379 | Redis | `lsof -i :6379` |
| 6380 | FalkorDB | `lsof -i :6380` |
| 5432 | PostgreSQL | `lsof -i :5432` |

---

## 🐛 Troubleshooting Rápido

```bash
# La app no carga
→ Verificar: docker ps
→ Reiniciar: ./stop.sh && ./start.sh

# Puerto ocupado
→ Ver qué usa: lsof -i :3000
→ Matar proceso: kill -9 [PID]

# Workers no procesan
→ Verificar Redis: docker ps | grep redis
→ Reiniciar workers: Ctrl+C y npm run workers

# FalkorDB no conecta
→ Ver logs: docker logs falkordb-dev
→ Reiniciar: docker restart falkordb-dev
```

---

## 📁 Archivos Importantes

```
src/lib/queue/workers.ts    # Código de workers
src/lib/cognee.ts           # Conexión FalkorDB
src/lib/pageindex-local.ts  # Procesamiento PDF
src/app/api/documents/      # API de documentos
prisma/schema.prisma        # Schema de BD
.env                        # Configuración (NO compartir)
```

---

## 🔄 Flujo de Subida de Documento

```
1. Usuario sube PDF
   ↓
2. Redis guarda trabajo en cola
   ↓
3. Worker toma trabajo
   ↓
4. Extrae texto del PDF
   ↓
5. IA analiza estructura
   ↓
6. Guarda entidades en FalkorDB
   ↓
7. Guarda índice en PostgreSQL
   ↓
8. Documento listo ✓
```

---

## 🎯 Tareas Comunes

### Ver cola de trabajos
```bash
docker exec -it redis-dev redis-cli
> LLEN document-processing
```

### Ver grafos en FalkorDB
```
1. http://localhost:3001
2. MATCH (n) RETURN n LIMIT 10
```

### Reiniciar servicio específico
```bash
docker restart falkordb-dev
docker restart redis-dev
```

### Ver logs de un servicio
```bash
docker logs -f [nombre-contenedor]
```

---

## 💾 Base de Datos

```bash
# Ver tablas
npm run db:studio

# Reiniciar schema (CUIDADO: borra datos)
npm run db:push

# Generar Prisma Client
npm run db:generate
```

---

## 🆘 Emergencias

### Todo está roto
```bash
# Detener todo
./stop.sh

# Limpiar contenedores
docker rm -f falkordb-dev redis-dev

# Iniciar desde cero
./start.sh
```

### BD corrupta
```bash
# Resetear schema
npm run db:push -- --force-reset
```

### Perdí mis archivos
```bash
# Ver uploads
ls -la uploads/

# Ver datos de FalkorDB
ls -la /home/alex/cetiem/falkordb-data/
```

---

## 📞 Checklist de Inicio de Día

- [ ] `./start.sh` ejecutado
- [ ] http://localhost:3000 accesible
- [ ] Login funciona (admin@local.dev)
- [ ] `docker ps` muestra 2 contenedores activos
- [ ] Workers corriendo (otra terminal)

---

## 📞 Checklist de Fin de Día

- [ ] `./stop.sh` ejecutado
- [ ] `docker ps` vacío (sin contenedores)
- [ ] Cambios en git commiteados
- [ ] `.env` no está en staging

---

**¿Problemas?** Revisar README.md completo o pedir ayuda en el canal del equipo.
