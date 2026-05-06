import { createRequire } from "module";

const require = createRequire(import.meta.url);

export const PROGRESS_CHANNEL_PREFIX = "doc:progress:";

function makeClient() {
  try {
    const Redis = require("ioredis");
    return new Redis({
      host: process.env.REDIS_HOST || "localhost",
      port: parseInt(process.env.REDIS_PORT || "6379"),
      maxRetriesPerRequest: 1,
      lazyConnect: true,
      enableOfflineQueue: false,
    });
  } catch {
    return null;
  }
}

// Singleton publisher — shared across updateProgress calls in the same worker process.
let _publisher: any = null;

function getPublisher() {
  if (!_publisher) _publisher = makeClient();
  return _publisher;
}

export async function publishProgress(
  documentId: string,
  payload: { step: string; percentage: number; details?: Record<string, any>; status?: string }
): Promise<void> {
  const pub = getPublisher();
  if (!pub) return;
  try {
    await pub.publish(
      `${PROGRESS_CHANNEL_PREFIX}${documentId}`,
      JSON.stringify(payload)
    );
  } catch {
    // Non-critical: Redis may be unavailable
  }
}

export function makeSubscriber() {
  return makeClient();
}
