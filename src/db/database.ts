import fs from "fs";
import path from "path";
import initSqlJs, { type Database } from "sql.js";
import { SEED_PRODUCTS } from "./seedData";

export type Db = Database;

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS products (
    product_id   TEXT PRIMARY KEY,
    name         TEXT    NOT NULL,
    quantity     INTEGER NOT NULL CHECK (quantity >= 0),
    last_updated TEXT    NOT NULL
  );
`;

/**
 * Opens the SQLite database (sql.js: SQLite compiled to WebAssembly, so there is
 * no native build step and it runs anywhere Node runs).
 *
 * - Existing file  → loaded from disk.
 * - No file yet    → schema created, sample data seeded, file written.
 * - ":memory:"     → fresh seeded database, nothing written (used by tests).
 */
export async function openDatabase(dbPath: string): Promise<Db> {
  const SQL = await initSqlJs();
  const inMemory = dbPath === ":memory:";

  const db =
    !inMemory && fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  db.exec(SCHEMA);

  if (countProducts(db) === 0) {
    seed(db);
    if (!inMemory) saveDatabase(db, dbPath);
  }
  return db;
}

export function countProducts(db: Db): number {
  const result = db.exec("SELECT COUNT(*) FROM products");
  return Number(result[0]?.values[0]?.[0] ?? 0);
}

export function seed(db: Db): void {
  const insert = db.prepare(
    `INSERT OR REPLACE INTO products (product_id, name, quantity, last_updated)
     VALUES (:productId, :name, :quantity, :lastUpdated)`,
  );
  db.exec("BEGIN");
  try {
    for (const p of SEED_PRODUCTS) {
      insert.run({ ":productId": p.productId, ":name": p.name, ":quantity": p.quantity, ":lastUpdated": p.lastUpdated });
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  } finally {
    insert.free();
  }
}

export function saveDatabase(db: Db, dbPath: string): void {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  fs.writeFileSync(dbPath, Buffer.from(db.export()));
}
