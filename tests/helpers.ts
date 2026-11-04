import pino from "pino";
import { createApp } from "../src/app";
import type { AppConfig } from "../src/config";
import { openDatabase } from "../src/db/database";
import { SqliteProductRepository, type ProductRepository } from "../src/repositories/productRepository";

export const silentLogger = pino({ level: "silent" });

export function testConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  return {
    port: 0,
    dbPath: ":memory:",
    logLevel: "silent",
    cacheTtlMs: 5_000,
    rateLimitWindowMs: 60_000,
    rateLimitMax: 1_000,
    ...overrides,
  };
}

/** App wired to a fresh, seeded in-memory database (or a stub repository). */
export async function buildTestApp(overrides: Partial<AppConfig> = {}, repository?: ProductRepository) {
  const config = testConfig(overrides);
  const repo = repository ?? new SqliteProductRepository(await openDatabase(":memory:"));
  return createApp({ config, logger: silentLogger, repository: repo });
}
