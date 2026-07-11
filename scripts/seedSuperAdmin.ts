/**
 * Seed (or update) the single super-admin account from env.
 *
 * Run with:  npm run seed:superadmin
 *
 * Reads SUPERADMIN_PHONE / SUPERADMIN_PASSWORD / SUPERADMIN_NAME from .env.local.
 * The super-admin has tenantId = null and lives at the root domain. Idempotent:
 * re-running updates the password/name for the same phone.
 */
import "./loadEnv";
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";

async function main() {
  const uri = process.env.MONGODB_URI;
  const phone = (process.env.SUPERADMIN_PHONE ?? "").trim();
  const password = process.env.SUPERADMIN_PASSWORD ?? "";
  const name = (process.env.SUPERADMIN_NAME ?? "Super Admin").trim();

  if (!uri) throw new Error("MONGODB_URI is not set");
  if (!phone || !password) {
    throw new Error("SUPERADMIN_PHONE and SUPERADMIN_PASSWORD must be set");
  }

  const dbName = new URL(uri).pathname.replace(/^\//, "") || "coaching_center";
  const client = new MongoClient(uri);

  try {
    await client.connect();
    const db = client.db(dbName);
    const users = db.collection("users");

    // Make sure the unique index exists before we upsert.
    await users.createIndex({ tenantId: 1, phone: 1 }, { unique: true });

    const passwordHash = await bcrypt.hash(password, 10);

    const res = await users.updateOne(
      { tenantId: null, role: "superadmin" },
      {
        $set: { name, phone, passwordHash, active: true },
        $setOnInsert: { tenantId: null, role: "superadmin" },
      },
      { upsert: true }
    );

    if (res.upsertedCount > 0) {
      console.log(`✅ Super admin created (phone: ${phone})`);
    } else {
      console.log(`✅ Super admin updated (phone: ${phone})`);
    }
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
