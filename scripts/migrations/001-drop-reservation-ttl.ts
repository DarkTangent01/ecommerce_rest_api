/**
 * One-off migration for audit fix C2.
 *
 * The inventoryReservations.expiresAt index used to be a TTL index, so MongoDB deleted
 * reservations after the payment window without putting their stock back. The schema no
 * longer declares it, but Mongoose never drops indexes on its own, so existing databases keep
 * deleting reservations until this script runs.
 *
 * Usage: DB_URL=mongodb://... yarn migrate:reservations-ttl [--dry-run]
 */
import mongoose from "mongoose";
import { connectDatabase } from "../../src/infrastructure/database/mongoose.js";
import { InventoryReservation } from "../../src/models/index.js";

const dryRun = process.argv.includes("--dry-run");

await connectDatabase();
try {
  const collection = InventoryReservation.collection;
  const indexes = await collection.indexes();
  const ttlIndexes = indexes.filter((index) => index.expireAfterSeconds !== undefined && index.key.expiresAt !== undefined);

  if (ttlIndexes.length === 0) {
    console.log("No TTL index on inventoryReservations.expiresAt; nothing to do.");
  }
  for (const index of ttlIndexes) {
    console.log(`${dryRun ? "[dry-run] would drop" : "Dropping"} TTL index ${index.name ?? "(unnamed)"}`);
    if (!dryRun && index.name) await collection.dropIndex(index.name);
  }

  if (!dryRun) {
    await InventoryReservation.createIndexes();
    console.log("Ensured { status: 1, expiresAt: 1 } index for the reservation sweeper.");
  }
} finally {
  await mongoose.disconnect();
}
