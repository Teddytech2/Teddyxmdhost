import { MongoClient, type Db } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is required for the MongoDB bot catalogue API.");

const globalForMongo = globalThis as typeof globalThis & {
  __teddyMongoClient?: MongoClient;
  __teddyMongoPromise?: Promise<MongoClient>;
};

const client = globalForMongo.__teddyMongoClient ?? new MongoClient(uri, {
  maxPoolSize: 5,
  serverSelectionTimeoutMS: 10000,
});
if (!globalForMongo.__teddyMongoClient) globalForMongo.__teddyMongoClient = client;

export async function getDb(): Promise<Db> {
  if (!globalForMongo.__teddyMongoPromise) {
    globalForMongo.__teddyMongoPromise = client.connect();
  }
  await globalForMongo.__teddyMongoPromise;
  return client.db(process.env.MONGODB_DB_NAME || "teddytech_deployer");
}
