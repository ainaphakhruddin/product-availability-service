/** Internal record, as stored in the data source. */
export interface ProductRecord {
  productId: string;
  name: string;
  quantity: number;
  lastUpdated: string; // ISO-8601 UTC
}

/** Public API contract for GET /availability/{productId}. */
export interface AvailabilityResponse {
  productId: string;
  inStock: boolean;
  availableQuantity: number;
  lastUpdated: string;
}
