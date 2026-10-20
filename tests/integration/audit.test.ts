import crypto from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { AuditLog } from "../../src/models/index.js";
import { writeTamperProofAudit } from "../../src/utils/auditLogger.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

describe("tamper-proof audit log (audit M12)", () => {
  it("keeps every concurrent entry with a gap-free sequence and an intact hash chain", async () => {
    await Promise.all(Array.from({ length: 20 }, (_, i) => writeTamperProofAudit("test.event", { tenant: "acme" }, { i })));

    const entries = await AuditLog.find().sort("sequence").lean();
    expect(entries.map((e) => e.sequence)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));

    let previousHash = "GENESIS";
    for (const entry of entries) {
      expect(entry.previousHash).toBe(previousHash);
      const body = {
        sequence: entry.sequence,
        action: entry.action,
        actor: entry.actor ?? null,
        tenant: entry.tenant,
        requestId: entry.requestId ?? null,
        ip: entry.ip ?? null,
        metadata: entry.metadata,
        previousHash: entry.previousHash,
      };
      expect(entry.hash).toBe(crypto.createHash("sha256").update(JSON.stringify(body)).digest("hex"));
      previousHash = entry.hash;
    }
  });
});
