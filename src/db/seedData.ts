import type { ProductRecord } from "../models/product";

/** Sample catalogue. Names are generic placeholders, not real Aritzia products. */
export const SEED_PRODUCTS: ProductRecord[] = [
  { productId: "12345", name: "Ribbed Knit Cardigan - Oatmeal", quantity: 42, lastUpdated: "2026-03-18T18:20:00Z" },
  { productId: "12346", name: "Wide-Leg Trouser - Black", quantity: 0, lastUpdated: "2026-03-18T17:05:00Z" },
  { productId: "12347", name: "Puffer Jacket - Espresso", quantity: 7, lastUpdated: "2026-03-18T16:45:00Z" },
  { productId: "12348", name: "Satin Slip Skirt - Champagne", quantity: 1, lastUpdated: "2026-03-18T15:30:00Z" },
  { productId: "12349", name: "Merino Turtleneck - Ivory", quantity: 128, lastUpdated: "2026-03-18T14:10:00Z" },
  { productId: "SKU-2026-001", name: "Wool Coat - Camel", quantity: 0, lastUpdated: "2026-03-17T22:00:00Z" },
  { productId: "12350", name: "Pleated Midi Skirt - Navy", quantity: 3, lastUpdated: "2026-11-04T20:00:00Z" },
];
