/**
 * One-off migration for security finding SEC-12.
 *
 * domainEvents had a unique `{ type, idempotencyKey }` index declared `sparse`. A compound sparse
 * index still indexes documents that only lack `idempotencyKey`, so just one un-keyed event of each
 * type could ever be stored. The schema now declares a partial index (keyed events only), but
 * Mongoose never drops indexes on its own, and production runs with autoIndex off.
 *
 * Usage: DB_URL=mongodb://... yarn migrate:domain-event-index [--dry-run]
 */
import mongoose from "mongoose";
import { connectDatabase } from "../../src/infrastructure/database/mongoose.js";
import { DomainEvent } from "../../src/models/index.js";
import { DOMAIN_EVENT_KEY_INDEX } from "../../src/models/domainEvent.js";

const dryRun = process.argv.includes("--dry-run");

await connectDatabase();
try {
  const collection = DomainEvent.collection;
  // A database that never stored an event has no collection yet.
  const indexes = await collection.indexes().catch(() => []);
  const legacy = indexes.filter(
    (index) => index.name !== DOMAIN_EVENT_KEY_INDEX && index.key.type !== undefined && index.key.idempotencyKey !== undefined && !index.partialFilterExpression
  );

  if (legacy.length === 0) {
    console.log("No legacy { type, idempotencyKey } index on domainEvents; nothing to drop.");
  }
  for (const index of legacy) {
    console.log(`${dryRun ? "[dry-run] would drop" : "Dropping"} index ${index.name ?? "(unnamed)"}`);
    if (!dryRun && index.name) await collection.dropIndex(index.name);
  }

  // Keyed events must be unique for the new index to build. Report conflicts; never delete events.
  const duplicates = await collection
    .aggregate<{ _id: { type: string; idempotencyKey: string }; count: number }>([
      { $match: { idempotencyKey: { $type: "string" } } },
      { $group: { _id: { type: "$type", idempotencyKey: "$idempotencyKey" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $limit: 20 },
    ])
    .toArray();
  if (duplicates.length) {
    console.error(`Found ${duplicates.length}+ duplicate keyed events; resolve them, then rerun:`);
    for (const dup of duplicates) console.error(`  type=${dup._id.type} idempotencyKey=${dup._id.idempotencyKey} rows=${dup.count}`);
    process.exitCode = 1;
  } else if (!dryRun) {
    await DomainEvent.createIndexes();
    console.log(`Ensured partial unique index ${DOMAIN_EVENT_KEY_INDEX}.`);
  }
} finally {
  await mongoose.disconnect();
}
