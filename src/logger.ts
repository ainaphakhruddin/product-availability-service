import pino from "pino";

/**
 * Structured JSON logs (one object per line) so they can be shipped straight to
 * Cloud Logging / any log aggregator and queried by field (requestId, productId...).
 */
export function createLogger(level = process.env.LOG_LEVEL ?? "info") {
  return pino({
    level,
    base: { service: "product-availability-service" },
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}

export type Logger = ReturnType<typeof createLogger>;
