import { describe, expect, it, vi } from "vitest";
import { AvailabilityService, toAvailability } from "../src/services/availabilityService";
import { TtlCache } from "../src/cache/ttlCache";
import { NotFoundError } from "../src/errors";
import type { ProductRepository } from "../src/repositories/productRepository";
import type { AvailabilityResponse, ProductRecord } from "../src/models/product";
import { silentLogger } from "./helpers";

const product = (quantity: number): ProductRecord => ({
  productId: "12345",
  name: "Test product",
  quantity,
  lastUpdated: "2026-03-18T18:20:00Z",
});

describe("toAvailability (business rule)", () => {
  it("is in stock when quantity > 0", () => {
    expect(toAvailability(product(42))).toEqual({
      productId: "12345",
      inStock: true,
      availableQuantity: 42,
      lastUpdated: "2026-03-18T18:20:00Z",
    });
  });

  it("is in stock at the boundary of 1", () => {
    expect(toAvailability(product(1)).inStock).toBe(true);
  });

  it("is out of stock when quantity is 0", () => {
    const result = toAvailability(product(0));
    expect(result.inStock).toBe(false);
    expect(result.availableQuantity).toBe(0);
  });

  it("does not expose internal fields such as name", () => {
    expect(toAvailability(product(5))).not.toHaveProperty("name");
  });
});

describe("AvailabilityService", () => {
  function setup(record: ProductRecord | undefined) {
    const repository: ProductRepository = { findById: vi.fn(() => record) };
    const cache = new TtlCache<AvailabilityResponse>(5_000);
    const service = new AvailabilityService(repository, cache, silentLogger);
    return { repository, cache, service };
  }

  it("throws NotFoundError when the product does not exist", () => {
    const { service } = setup(undefined);
    expect(() => service.getAvailability("99999")).toThrow(NotFoundError);
  });

  it("serves repeat reads from the cache", () => {
    const { service, repository } = setup(product(3));
    service.getAvailability("12345");
    service.getAvailability("12345");
    expect(repository.findById).toHaveBeenCalledTimes(1);
  });

  it("goes to the data source when the caller bypasses the cache", () => {
    const { service, repository } = setup(product(3));
    service.getAvailability("12345");
    service.getAvailability("12345", { bypassCache: true });
    expect(repository.findById).toHaveBeenCalledTimes(2);
  });

  it("does not cache not-found results", () => {
    const { service, cache } = setup(undefined);
    expect(() => service.getAvailability("99999")).toThrow();
    expect(cache.size).toBe(0);
  });
});

describe("TtlCache", () => {
  it("expires entries after the TTL", () => {
    let now = 0;
    const cache = new TtlCache<string>(1_000, 10, () => now);
    cache.set("a", "x");
    now = 999;
    expect(cache.get("a")).toBe("x");
    now = 1_000;
    expect(cache.get("a")).toBeUndefined();
  });

  it("evicts the oldest entry when full", () => {
    const cache = new TtlCache<number>(60_000, 2);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    expect(cache.get("a")).toBeUndefined();
    expect(cache.get("c")).toBe(3);
  });

  it("is disabled when TTL is 0", () => {
    const cache = new TtlCache<number>(0);
    cache.set("a", 1);
    expect(cache.get("a")).toBeUndefined();
  });
});
