/**
 * Thin wrapper that preserves the public API surface used by
 * /api/documents/[id]/process while delegating to the canonical pipeline.
 */

import type { CogneeDomain, ExtractionConfig } from './cognee-service';
import { runFullPipeline } from './document-pipeline';

export type { ProcessResult } from './document-pipeline';

export async function processDocument(
  documentId: string,
  domain?: CogneeDomain,
  extractionConfig?: ExtractionConfig
) {
  return runFullPipeline(documentId, domain, extractionConfig);
}
