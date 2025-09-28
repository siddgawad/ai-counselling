// src/lib/mongo.ts
import { MongoClient, Db, Collection } from 'mongodb';

const uri = process.env.MONGODB_URI;
const dbName = process.env.MONGO_DB ?? 'coach';

if (!uri) {
  throw new Error('MONGODB_URI is not set');
}

// Global promise cache (Next.js hot-reload safe)
declare global {

  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

const client = new MongoClient(uri, { maxPoolSize: 5 });
const clientPromise: Promise<MongoClient> =
  global._mongoClientPromise ?? client.connect();

if (!global._mongoClientPromise) {
  global._mongoClientPromise = clientPromise;
}

/** Get the database instance. */
export async function getDb(): Promise<Db> {
  const c = await clientPromise;
  return c.db(dbName);
}

/** Get a strongly-typed collection. */
export async function getCollection<TSchema extends Record<string, unknown>>(
  name: string,
): Promise<Collection<TSchema>> {
  const db = await getDb();
  return db.collection<TSchema>(name);
}
