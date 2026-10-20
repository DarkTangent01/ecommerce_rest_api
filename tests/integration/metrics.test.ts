import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { emitAlert, keyFor, MAX_ALERTS, snapshotMetrics } from "../../src/observability/metrics.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { api, createProduct, TENANT } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

const seriesCount = () => Object.keys(snapshotMetrics().requests).length;

describe("metrics cardinality (SEC-04)", () => {
  it("records unknown paths under one bounded label instead of one key per path", async () => {
    await api().get("/api/does-not-exist-warmup");
    const before = seriesCount();

    for (let i = 0; i < 150; i++) {
      await api().get(`/api/x-${i}-${"A".repeat(500)}`);
    }

    expect(seriesCount() - before).toBeLessThanOrEqual(1);
    const keys = Object.keys(snapshotMetrics().requests);
    expect(keys.some((key) => key.includes("x-149"))).toBe(false);
    expect(keys).toContain("GET unmatched 404");
  });

  it("labels matched requests with the route template, not the concrete id", async () => {
    const product = await createProduct();
    await api().get(`/api/products/${String(product._id)}`).set("X-Tenant-Id", TENANT);
    const keys = Object.keys(snapshotMetrics().requests);
    expect(keys).toContain("GET /products/:id 200");
    expect(keys.some((key) => key.includes(String(product._id)))).toBe(false);
  });

  it("maps unknown methods and invalid status codes to fixed labels", () => {
    expect(keyFor({ method: "PROPFIND", route: undefined }, 404)).toBe("OTHER unmatched 404");
    expect(keyFor({ method: "GET", route: { path: "/health" } }, 9999)).toBe("GET /health 0");
  });

  it("keeps only the most recent alerts", () => {
    for (let i = 0; i < MAX_ALERTS + 50; i++) emitAlert("test.alert", "low", { i });
    const { alerts } = snapshotMetrics();
    expect(alerts.length).toBeLessThanOrEqual(MAX_ALERTS);
    expect(alerts.at(-1)!.payload).toEqual({ i: MAX_ALERTS + 49 });
  });
});
