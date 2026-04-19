import { MongoClient } from "mongodb";

/**
 * In Next.js development mode, Hot Module Replacement (HMR) causes
 * modules to be frequently recompiled. We use a global variable (`globalForMongo`)
 * to store the MongoDB client promise. This prevents HMR from repeatedly
 * opening new connections to the database and hitting connection limits.
 */
const globalForMongo = globalThis as typeof globalThis & {
  mongoClientPromise?: Promise<MongoClient>;
};

function getMongoClientPromise() {
  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error("Missing MONGODB_URI environment variable.");
  }

  if (!globalForMongo.mongoClientPromise) {
    globalForMongo.mongoClientPromise = new MongoClient(uri).connect();
  }

  return globalForMongo.mongoClientPromise;
}

/**
 * Connects to the MongoDB cluster and returns the `hackathonhaz` database instance.
 * Reuses the existing connection promise if it was already established.
 *
 * @returns A promise that resolves to the MongoDB database instance.
 */
export async function getDatabase() {
  const client = await getMongoClientPromise();

  return client.db("hackathonhaz");
}
