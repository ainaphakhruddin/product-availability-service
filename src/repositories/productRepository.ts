import type { Db } from "../db/database";
import type { ProductRecord } from "../models/product";

/**
 * Data-access contract. The service layer depends on this interface, not on
 * SQLite, so the source can be swapped (the commerce platform's inventory API,
 * Cloud SQL, a Pub/Sub-fed read model...) without touching business logic.
 */
export interface ProductRepository {
  findById(productId: string): ProductRecord | undefined;
}

interface ProductRow {
  product_id: string;
  name: string;
  quantity: number;
  last_updated: string;
}

export class SqliteProductRepository implements ProductRepository {
  // Prepared once and reused: parameterised (no SQL injection) and no re-parsing per call.
  private readonly byId;

  constructor(db: Db) {
    // Primary-key lookup: served by the PRIMARY KEY index, O(log n).
    this.byId = db.prepare(
      "SELECT product_id, name, quantity, last_updated FROM products WHERE product_id = :id",
    );
  }

  findById(productId: string): ProductRecord | undefined {
    try {
      this.byId.bind({ ":id": productId });
      if (!this.byId.step()) return undefined;
      const row = this.byId.getAsObject() as unknown as ProductRow;
      return {
        productId: row.product_id,
        name: row.name,
        quantity: Number(row.quantity),
        lastUpdated: row.last_updated,
      };
    } finally {
      this.byId.reset(); // make the statement reusable for the next call
    }
  }
}
