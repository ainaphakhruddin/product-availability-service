import { beforeAll, describe, expect, it } from "vitest";
import type { Express } from "express";
import request from "supertest";
import { buildTestApp } from "./helpers";
import type { ProductRepository } from "../src/repositories/productRepository";

describe("GET /availability/:productId", () => {
  let app: Express;
  beforeAll(async () => {
    app = await buildTestApp();
  });

  it("200 with the contract shape for an in-stock product", async () => {
    const res = await request(app).get("/availability/12345");
    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({
      productId: "12345",
      inStock: true,
      availableQuantity: 42,
      lastUpdated: "2026-03-18T18:20:00Z",
    });
  });

  it("200 with inStock=false when quantity is 0", async () => {
    const res = await request(app).get("/availability/12346");
    expect(res.status).toBe(200);
    expect(res.body.inStock).toBe(false);
    expect(res.body.availableQuantity).toBe(0);
  });

  it("supports SKU-style IDs", async () => {
    const res = await request(app).get("/availability/SKU-2026-001");
    expect(res.status).toBe(200);
  });

  it("404 PRODUCT_NOT_FOUND for an unknown product", async () => {
    const res = await request(app).get("/availability/99999");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("PRODUCT_NOT_FOUND");
    expect(res.body.error.requestId).toBeTruthy();
  });

  it.each([
    ["special characters", "abc$123"],
    ["a space", "abc%20123"],
    ["path traversal", "..%2F..%2Fetc"],
    ["over 64 characters", "a".repeat(65)],
  ])("400 INVALID_PRODUCT_ID for %s", async (_label, id) => {
    const res = await request(app).get(`/availability/${id}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_PRODUCT_ID");
  });

  it("404 ROUTE_NOT_FOUND when productId is missing", async () => {
    const res = await request(app).get("/availability/");
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ROUTE_NOT_FOUND");
  });

  it("echoes a caller-supplied X-Request-Id", async () => {
    const res = await request(app).get("/availability/12345").set("X-Request-Id", "trace-abc-123");
    expect(res.headers["x-request-id"]).toBe("trace-abc-123");
  });

  it("500 INTERNAL_ERROR without leaking internals when the data source fails", async () => {
    const failing: ProductRepository = {
      findById: () => {
        throw new Error("SQLITE_BUSY: database is locked at /secret/path");
      },
    };
    const res = await request(await buildTestApp({}, failing)).get("/availability/12345");
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("SQLITE_BUSY");
  });
});

describe("rate limiting", () => {
  it("returns 429 once the limit is exceeded", async () => {
    const app = await buildTestApp({ rateLimitMax: 2 });
    await request(app).get("/availability/12345").expect(200);
    await request(app).get("/availability/12345").expect(200);
    const res = await request(app).get("/availability/12345");
    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe("RATE_LIMITED");
  });
});

describe("operational endpoints", () => {
  let app: Express;
  beforeAll(async () => {
    app = await buildTestApp();
  });

  it("GET /health is ok", async () => {
    const res = await request(app).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("serves the OpenAPI spec", async () => {
    const res = await request(app).get("/openapi.json");
    expect(res.status).toBe(200);
    expect(res.body.paths).toHaveProperty("/availability/{productId}");
  });
});
