/**
 * Tenant-isolation proof. Run with:  npx tsx scripts/testIsolation.ts
 *
 * Exercises the scoped layer with two fake tenants (A and B) on a throwaway
 * collection and asserts that NOTHING leaks across the boundary — including
 * deliberate attempts to escape by passing another tenant's id in a filter or
 * a $set. Cleans up after itself.
 */
import "./loadEnv";
import { getClient, getDb } from "../lib/db/connect";
import { forTenant } from "../lib/db/scoped";
import type { CollectionName } from "../lib/db/collections";

const COL = "_isolationTest" as unknown as CollectionName;
const A = "tenantAAAAAAAAAAAAAAAAAAA";
const B = "tenantBBBBBBBBBBBBBBBBBBB";

let passed = 0;
let failed = 0;
function check(label: string, cond: boolean) {
  if (cond) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.log(`  ❌ ${label}`);
  }
}

async function main() {
  const db = await getDb();
  await db.collection(COL).deleteMany({}); // clean slate

  const a = forTenant(A).collection(COL);
  const b = forTenant(B).collection(COL);

  // 1. Inserts get stamped with the bound tenantId.
  const ra = await a.insertOne({ name: "alice" } as never);
  await b.insertOne({ name: "bob" } as never);
  const rawA = await db.collection(COL).findOne({ _id: ra.insertedId });
  check("insertOne stamps tenantId", (rawA as { tenantId?: string })?.tenantId === A);

  // 2. find only sees own tenant.
  const aDocs = await a.findArray();
  check("A.find() returns only A docs", aDocs.length === 1 && aDocs[0].name === "alice");

  // 3. Trying to read B's docs from A is impossible even with explicit filter:
  // the injected `tenantId: A` OVERWRITES the caller's `tenantId: B`, so A can
  // only ever see its own data (here, alice) — never B's.
  const sneak = (await a.findOne({ tenantId: B } as never)) as
    | { tenantId?: string; name?: string }
    | null;
  check(
    "A.findOne({tenantId:B}) cannot return B's data (tenantId forced to A)",
    sneak === null || (sneak.tenantId === A && sneak.name !== "bob")
  );

  const sneakName = await a.findOne({ name: "bob" } as never);
  check("A.findOne({name:'bob'}) cannot see B's doc", sneakName === null);

  // 4. Count is scoped.
  check("A.countDocuments() == 1", (await a.countDocuments()) === 1);
  check("B.countDocuments() == 1", (await b.countDocuments()) === 1);

  // 5. update cannot move a doc into another tenant via $set.
  await a.updateOne({ name: "alice" } as never, { $set: { tenantId: B, note: "x" } } as never);
  const aliceAfter = await db.collection(COL).findOne({ name: "alice" });
  check(
    "updateOne cannot change tenantId via $set",
    (aliceAfter as { tenantId?: string })?.tenantId === A
  );

  // 6. A cannot delete B's doc.
  const del = await a.deleteOne({ name: "bob" } as never);
  check("A.deleteOne on B's doc deletes nothing", del.deletedCount === 0);
  check("B still has its doc", (await b.countDocuments()) === 1);

  // 7. upsert stamps tenantId on the new doc.
  await a.updateOne(
    { name: "carol" } as never,
    { $set: { note: "new" } } as never,
    { upsert: true }
  );
  const carol = await db.collection(COL).findOne({ name: "carol" });
  check("upsert stamps tenantId on insert", (carol as { tenantId?: string })?.tenantId === A);

  // 8. aggregate is scoped to the tenant.
  const agg = await (await a.aggregate([{ $count: "n" }])).toArray();
  check("A.aggregate count == 2 (alice+carol)", (agg[0] as { n?: number })?.n === 2);

  // 9. bulkWrite upsert stamps tenantId on the new doc.
  await a.bulkWrite([{ updateOne: { filter: { name: "dave" } as never, update: { $set: { v: 1 } } as never, upsert: true } }]);
  const dave = await db.collection(COL).findOne({ name: "dave" });
  check("bulkWrite upsert stamps tenantId", (dave as { tenantId?: string })?.tenantId === A);

  // 10. bulkWrite from A cannot modify B's doc (tenantId forced to A → no match).
  await a.bulkWrite([{ updateOne: { filter: { tenantId: B, name: "bob" } as never, update: { $set: { hacked: true } } as never } }]);
  const bobAfterBulk = await db.collection(COL).findOne({ name: "bob" });
  check("bulkWrite cannot modify another tenant's doc", (bobAfterBulk as { hacked?: boolean })?.hacked !== true);

  // 11. bulkWrite delete from A cannot remove B's doc.
  await a.bulkWrite([{ deleteOne: { filter: { name: "bob" } as never } }]);
  check("bulkWrite deleteOne cannot delete another tenant's doc", (await b.countDocuments()) === 1);

  // cleanup
  await db.collection(COL).deleteMany({});

  console.log(`\n${failed === 0 ? "✅ ALL PASSED" : "❌ FAILURES"}: ${passed} passed, ${failed} failed`);
  await (await getClient()).close();
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Isolation test crashed:", err);
  process.exit(1);
});
