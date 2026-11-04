import { loadConfig } from "./config";
import { createLogger } from "./logger";
import { openDatabase } from "./db/database";
import { SqliteProductRepository } from "./repositories/productRepository";
import { createApp } from "./app";

async function main() {
  const config = loadConfig();
  const logger = createLogger(config.logLevel);
  const db = await openDatabase(config.dbPath);
  const app = createApp({ config, logger, repository: new SqliteProductRepository(db) });

  const server = app.listen(config.port, () => {
    logger.info({ port: config.port, dbPath: config.dbPath }, "product-availability-service started");
  });

  // Graceful shutdown: stop accepting connections, finish in-flight requests, close the DB.
  const shutdown = (signal: string) => {
    logger.info({ signal }, "shutting down");
    server.close(() => {
      db.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10_000).unref();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}

main().catch((err) => {
  console.error("failed to start", err);
  process.exit(1);
});
