/**
 * One-off migration for security finding SEC-08.
 *
 * shipments had a unique { order } index (one shipment per order). Shipments are now one per
 * seller per order, unique on { order, seller }. Existing rows have no seller, which MongoDB reads
 * as null: an admin shipment covering the whole order, which is what they were. No rows change.
 *
 * Usage: DB_URL=mongodb://... yarn migrate:shipment-per-seller [--dry-run]
 */
import mongoose from "mongoose";
import { connectDatabase } from "../../src/infrastructure/database/mongoose.js";
import { Shipment } from "../../src/models/index.js";
import { SHIPMENT_KEY_INDEX } from "../../src/models/shipment.js";

const dryRun = process.argv.includes("--dry-run");

await connectDatabase();
try {
  const collection = Shipment.collection;
  const indexes = await collection.indexes().catch(() => []);
  const legacy = indexes.filter((index) => index.unique && Object.keys(index.key).length === 1 && index.key.order !== undefined);

  if (legacy.length === 0) console.log("No legacy unique { order } index on shipments; nothing to drop.");
  for (const index of legacy) {
    console.log(`${dryRun ? "[dry-run] would drop" : "Dropping"} index ${index.name ?? "(unnamed)"}`);
    if (!dryRun && index.name) await collection.dropIndex(index.name);
  }

  // The new index cannot be built if two rows share { order, seller }. Report them; never delete.
  const duplicates = await collection
    .aggregate<{ _id: { order: unknown; seller: unknown }; count: number }>([
      { $group: { _id: { order: "$order", seller: { $ifNull: ["$seller", null] } }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();
  if (duplicates.length) {
    console.error(`Found ${duplicates.length}+ duplicate { order, seller } groups; resolve them, then rerun:`);
    for (const dup of duplicates) console.error(`  order=${String(dup._id.order)} seller=${String(dup._id.seller)} rows=${dup.count}`);
    process.exitCode = 1;
  } else if (!dryRun) {
    await Shipment.createIndexes();
    console.log(`Ensured unique index ${SHIPMENT_KEY_INDEX}.`);
  }
} finally {
  await mongoose.disconnect();
}
