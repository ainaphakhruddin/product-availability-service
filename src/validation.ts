import { ValidationError } from "./errors";

/**
 * Product IDs are 1–64 chars of letters, digits, hyphens or underscores
 * (covers numeric IDs like "12345" and SKU-style IDs like "SKU-2026-001").
 * Validating at the edge rejects junk before it reaches the data source.
 */
export const PRODUCT_ID_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export function validateProductId(raw: unknown): string {
  if (typeof raw !== "string") {
    throw new ValidationError("productId is required");
  }
  const productId = raw.trim();
  if (!PRODUCT_ID_PATTERN.test(productId)) {
    throw new ValidationError(
      "productId must be 1-64 characters and contain only letters, digits, hyphens or underscores",
    );
  }
  return productId;
}
