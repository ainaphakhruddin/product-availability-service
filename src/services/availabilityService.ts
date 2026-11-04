import { NotFoundError } from "../errors";
import type { Logger } from "../logger";
import type { AvailabilityResponse, ProductRecord } from "../models/product";
import type { ProductRepository } from "../repositories/productRepository";
import type { TtlCache } from "../cache/ttlCache";

export interface GetAvailabilityOptions {
  /** Skip the cache, e.g. for checkout where a stale answer could oversell. */
  bypassCache?: boolean;
}

/** Business rule: a product is in stock when quantity > 0. */
export function toAvailability(product: ProductRecord): AvailabilityResponse {
  return {
    productId: product.productId,
    inStock: product.quantity > 0,
    availableQuantity: product.quantity,
    lastUpdated: product.lastUpdated,
  };
}

export class AvailabilityService {
  constructor(
    private readonly repository: ProductRepository,
    private readonly cache: TtlCache<AvailabilityResponse>,
    private readonly logger: Logger,
  ) {}

  getAvailability(productId: string, options: GetAvailabilityOptions = {}): AvailabilityResponse {
    if (!options.bypassCache) {
      const cached = this.cache.get(productId);
      if (cached) {
        this.logger.debug({ productId, cache: "hit" }, "availability served from cache");
        return cached;
      }
    }

    const product = this.repository.findById(productId);
    if (!product) {
      // Logged once, with the request ID, by the error handler.
      throw new NotFoundError(`Product '${productId}' was not found`);
    }

    const availability = toAvailability(product);
    // Only found products are cached; a product created a moment ago must not be
    // hidden behind a cached 404.
    this.cache.set(productId, availability);
    this.logger.debug({ productId, cache: options.bypassCache ? "bypass" : "miss" }, "availability loaded");
    return availability;
  }
}
