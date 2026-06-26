import { MongoClient, type Db } from "mongodb";
import { ensureIndexes } from "./indexes";

/**
 * Cached MongoDB connection for a serverless runtime.
 *
 * On Vercel each lambda invocation may reuse a warm container. Without caching
 * we would open a brand-new connection (and exhaust the M0 100-connection cap)
 * on every request. We stash the client promise on `globalThis` so it survives
 * hot reloads in dev and warm invocations in prod.
 */

const uri = process.env.MONGODB_URI;
if (!uri) {
  throw new Error("MONGODB_URI is not set. Add it to .env.local");
}

// Derive the DB name from the connection string path, fall back to a default.
const DB_NAME = (() => {
  try {
    const path = new URL(uri).pathname.replace(/^\//, "");
    return path || "coaching_center";
  } catch {
    return "coaching_center";
  }
})();

type GlobalMongo = {
  clientPromise?: Promise<MongoClient>;
  indexesReady?: Promise<void>;
};

const globalForMongo = globalThis as unknown as { _mongo?: GlobalMongo };
const cache: GlobalMongo = (globalForMongo._mongo ??= {});

function createClient(): Promise<MongoClient> {
  const client = new MongoClient(uri!, {
    // Keep the pool tiny — M0 allows only 100 connections shared across all
    // warm lambdas, so each instance must stay frugal.
    maxPoolSize: 5,
    minPoolSize: 0,
    retryWrites: true,
  });
  return client.connect();
}

export async function getClient(): Promise<MongoClient> {
  if (!cache.clientPromise) {
    cache.clientPromise = createClient();
  }
  return cache.clientPromise;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  const db = client.db(DB_NAME);
  // Ensure indexes exactly once per process (idempotent on Mongo's side).
  if (!cache.indexesReady) {
    cache.indexesReady = ensureIndexes(db).catch((err) => {
      // Don't crash request handling if index creation races; log and reset so
      // a later request can retry.
      console.error("ensureIndexes failed:", err);
      cache.indexesReady = undefined;
    });
  }
  return db;
}

export const dbName = DB_NAME;
