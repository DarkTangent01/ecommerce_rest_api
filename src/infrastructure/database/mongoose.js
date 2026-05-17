import mongoose from "mongoose";
import { DB_URL, ENABLE_QUERY_PROFILING, NODE_ENV } from "../../config/index.js";
import { logEvent } from "../../shared/logging/requestContext.js";

mongoose.set("bufferCommands", false);

if (ENABLE_QUERY_PROFILING) {
  mongoose.set("debug", (collection, method, query, doc) => {
    logEvent("debug", "db.query", null, { collection, method, query, doc });
  });
}

export const connectDatabase = async () => {
  const mongodbURI = process.env.DB_URL || DB_URL;
  return mongoose.connect(mongodbURI, {
    autoIndex: NODE_ENV !== "production",
    serverSelectionTimeoutMS: 3000,
  });
};

export const registerDatabaseEvents = () => {
  const db = mongoose.connection;
  db.on("error", (err) => {
    console.error(`Connection Error: ${err.message}`);
  });
  db.once("open", () => {
    console.log("[+] DB Connected...");
  });
};

export { mongoose };
