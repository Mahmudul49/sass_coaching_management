/**
 * Create all indexes once, on demand.  Run with: npm run db:indexes
 * (Indexes are also created lazily on first DB use; this script is handy for
 * provisioning a fresh Atlas database explicitly.)
 */
import "./loadEnv";
import { MongoClient } from "mongodb";
import { ensureIndexes } from "../lib/db/indexes";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set");

  const dbName = new URL(uri).pathname.replace(/^\//, "") || "coaching_center";
  const client = new MongoClient(uri);
  try {
    await client.connect();
    await ensureIndexes(client.db(dbName));
    console.log("✅ Indexes ensured");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("❌ Index creation failed:", err);
  process.exit(1);
});
