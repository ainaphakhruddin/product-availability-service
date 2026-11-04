/** `npm run db:seed` — resets the local database to the sample catalogue. */
import { loadConfig } from "../config";
import { countProducts, openDatabase, saveDatabase, seed } from "./database";

async function main() {
  const { dbPath } = loadConfig();
  const db = await openDatabase(dbPath);
  db.exec("DELETE FROM products");
  seed(db);
  saveDatabase(db, dbPath);
  console.log(`Seeded ${countProducts(db)} products into ${dbPath}`);
  db.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
