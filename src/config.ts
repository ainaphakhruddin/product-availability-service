import path from "path";

/**
 * Central configuration. Everything is overridable by environment variable so the
 * same image runs locally, in Docker, and (later) on Cloud Run without code changes.
 */
function int(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) {
    throw new Error(`Invalid value for ${name}: "${raw}" (expected a non-negative integer)`);
  }
  return n;
}

export interface AppConfig {
  port: number;
  dbPath: string;
  logLevel: string;
  cacheTtlMs: number;
  rateLimitWindowMs: number;
  rateLimitMax: number;
}

export function loadConfig(): AppConfig {
  return {
    port: int("PORT", 3000),
    dbPath: process.env.DB_PATH ?? path.join(process.cwd(), "data", "products.db"),
    logLevel: process.env.LOG_LEVEL ?? "info",
    // Short TTL: storefront reads tolerate a few seconds of staleness; checkout can bypass.
    cacheTtlMs: int("CACHE_TTL_MS", 5_000),
    rateLimitWindowMs: int("RATE_LIMIT_WINDOW_MS", 60_000),
    rateLimitMax: int("RATE_LIMIT_MAX", 100),
  };
}
