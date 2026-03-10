/**
 * Script para inicializar workers de procesamiento
 * Ejecutar con: npm run workers
 */

import {
  createDocumentProcessingWorker,
  createAIAnalysisWorker,
  createReportGenerationWorker,
  checkRedisHealth,
} from "../queue/index.js";

async function startWorkers() {
  console.log("🚀 Iniciando workers de procesamiento...");

  // Verificar que Redis esté disponible antes de iniciar
  console.log("🔍 Verificando conexión con Redis...");
  const redisAvailable = await checkRedisHealth(10);
  
  if (!redisAvailable) {
    console.error("❌ ERROR: Redis no está disponible. Los workers no pueden iniciar.");
    console.error("   Asegúrate de que Redis esté corriendo en el puerto 6379");
    console.error("   Ejecuta: docker run -d --name redis-dev -p 6379:6379 redis:7-alpine");
    process.exit(1);
  }

  console.log("✅ Redis disponible, iniciando workers...");

  // Crear workers
  const documentWorker = await createDocumentProcessingWorker();
  const aiWorker = await createAIAnalysisWorker();
  const reportWorker = await createReportGenerationWorker();

  console.log("✅ Workers iniciados:");
  console.log("   - Document Processing Worker");
  console.log("   - AI Analysis Worker");
  console.log("   - Report Generation Worker");
  console.log("\n📌 Los workers están escuchando trabajos...\n");

  // Manejar señales de terminación
  process.on("SIGINT", async () => {
    console.log("\n⏹️  Deteniendo workers...");
    await documentWorker.close();
    await aiWorker.close();
    await reportWorker.close();
    console.log("✅ Workers detenidos");
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\n⏹️  Deteniendo workers...");
    await documentWorker.close();
    await aiWorker.close();
    await reportWorker.close();
    console.log("✅ Workers detenidos");
    process.exit(0);
  });
}

// Iniciar si se ejecuta directamente
startWorkers().catch((error) => {
  console.error("❌ Error iniciando workers:", error);
  process.exit(1);
});
