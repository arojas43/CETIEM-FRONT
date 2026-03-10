/**
 * Script CLI para procesamiento de documentos
 * Uso: npx tsx process-document.ts [documentId] [dominio]
 */

import { processDocument } from './src/lib/process-document-service';
import { prisma } from './src/lib/db';
import type { CogneeDomain } from './src/lib/cognee-service';
import { fileURLToPath } from 'url';

// Ejecutar desde CLI
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log(`
📄 Uso: npx tsx process-document.ts [documentId] [dominio]

Dominios disponibles:
  - medical    (documentos médicos)
  - legal      (documentos legales/normativos)
  - technical  (documentos técnicos)
  - academic   (documentos académicos)
  - custom     (genérico)

Ejemplos:
  npx tsx process-document.ts cmmdpia98000142fp6dz96u2d
  npx tsx process-document.ts cmmdpia98000142fp6dz96u2d legal
  npx tsx process-document.ts cmmdpia98000142fp6dz96u2d medical
`);
    process.exit(0);
  }

  const documentId = args[0];
  const domainArg = args[1] as CogneeDomain | undefined;

  const validDomains: CogneeDomain[] = ['medical', 'legal', 'technical', 'academic', 'custom'];
  const domain = domainArg && validDomains.includes(domainArg) ? domainArg : undefined;

  if (domainArg && !domain) {
    console.warn(`⚠️  Dominio "${domainArg}" no válido, usando default (legal)`);
  }

  try {
    const result = await processDocument(documentId, domain);
    process.exit(result.success ? 0 : 1);
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar si es el archivo principal
const __filename = fileURLToPath(import.meta.url);
const isMain = process.argv[1] === __filename;

if (isMain) {
  main().catch(console.error);
}
