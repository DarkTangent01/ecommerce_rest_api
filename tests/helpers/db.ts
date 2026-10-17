import { MongoMemoryReplSet, MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

type Mongo = MongoMemoryReplSet | MongoMemoryServer;

let mongo: Mongo | undefined;

/**
 * Starts an in-memory MongoDB and connects Mongoose to it.
 * `replSet: true` (default) supports transactions; `false` gives a standalone server, which
 * exercises the non-transactional fallback paths.
 */
export const startDb = async ({ replSet = true }: { replSet?: boolean } = {}) => {
  mongo = replSet ? await MongoMemoryReplSet.create({ replSet: { count: 1, storageEngine: "wiredTiger" } }) : await MongoMemoryServer.create();
  const uri = mongo.getUri();
  process.env.DB_URL = uri;
  await mongoose.connect(uri, { dbName: "ecommerce_test" });
  await mongoose.connection.syncIndexes();
};

export const clearDb = async () => {
  const collections = await mongoose.connection.db!.collections();
  await Promise.all(collections.map((collection) => collection.deleteMany({})));
};

export const stopDb = async () => {
  await mongoose.disconnect();
  await mongo?.stop();
  mongo = undefined;
};
