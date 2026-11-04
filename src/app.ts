import fs from "fs";
import path from "path";
import express, { type Express } from "express";
import { pinoHttp } from "pino-http";
import { rateLimit } from "express-rate-limit";
import swaggerUi from "swagger-ui-express";
import YAML from "yaml";

import type { AppConfig } from "./config";
import type { Logger } from "./logger";
import type { ProductRepository } from "./repositories/productRepository";
import type { AvailabilityResponse } from "./models/product";
import { TtlCache } from "./cache/ttlCache";
import { AvailabilityService } from "./services/availabilityService";
import { AvailabilityController } from "./controllers/availabilityController";
import { errorHandler, notFoundRoute } from "./middleware/errorHandler";
import { genRequestId } from "./middleware/requestId";

export interface AppDeps {
  config: AppConfig;
  logger: Logger;
  repository: ProductRepository;
}

/**
 * Builds the Express app with its dependencies injected (composition root).
 * Tests call this with an in-memory database; server.ts calls it with the real one.
 */
export function createApp({ config, logger, repository }: AppDeps): Express {
  const cache = new TtlCache<AvailabilityResponse>(config.cacheTtlMs);
  const service = new AvailabilityService(repository, cache, logger);
  const controller = new AvailabilityController(service, config.cacheTtlMs);

  const app = express();
  app.disable("x-powered-by");

  // Log every request once on completion: method, url, status, latency, requestId.
  app.use(
    pinoHttp({
      logger,
      genReqId: genRequestId,
      customLogLevel: (_req, res, err) =>
        err || res.statusCode >= 500 ? "error" : res.statusCode >= 400 ? "warn" : "info",
      serializers: {
        req: (req) => ({ id: req.id, method: req.method, url: req.url }),
        res: (res) => ({ statusCode: res.statusCode }),
      },
    }),
  );

  // Liveness probe (Cloud Run / Kubernetes). Not rate limited.
  app.get("/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // API docs.
  const specPath = path.join(__dirname, "..", "openapi.yaml");
  if (fs.existsSync(specPath)) {
    const spec = YAML.parse(fs.readFileSync(specPath, "utf8"));
    app.get("/openapi.json", (_req, res) => {
      res.json(spec);
    });
    app.use("/docs", swaggerUi.serve, swaggerUi.setup(spec));
  }

  // Per-client rate limit on the API. Returns 429 with RateLimit-* headers.
  const limiter = rateLimit({
    windowMs: config.rateLimitWindowMs,
    limit: config.rateLimitMax,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: (req, res) => {
      req.log.warn("rate limit exceeded");
      res.status(429).json({
        error: { code: "RATE_LIMITED", message: "Too many requests, please retry later", requestId: String(req.id) },
      });
    },
  });

  app.get("/availability/:productId", limiter, controller.getAvailability);

  app.use(notFoundRoute);
  app.use(errorHandler);
  return app;
}
