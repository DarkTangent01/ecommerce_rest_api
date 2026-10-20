import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { SERVICE_JWT_SECRET } from "../../src/config/index.js";
import { DomainEvent } from "../../src/models/index.js";
import { createServiceToken } from "../../src/infra/serviceClient.js";
import { JwtService } from "../../src/services/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { api } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

const seed = () =>
  DomainEvent.create([
    { type: "order.created", aggregateType: "order", tenant: "acme" },
    { type: "order.created", aggregateType: "order", tenant: "globex" },
  ]);

describe("internal events tenant scope (I-7)", () => {
  it("returns only the events of the tenant in the service token", async () => {
    await seed();
    const token = createServiceToken("reporting", ["events:read"], "acme");
    const res = await api().get("/api/internal/events").set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect((res.body.data as { tenant: string }[]).map((event) => event.tenant)).toEqual(["acme"]);
  });

  it("ignores an X-Tenant-Id that names another tenant", async () => {
    await seed();
    const token = createServiceToken("reporting", ["events:read"], "acme");
    const res = await api().get("/api/internal/events").set("Authorization", `Bearer ${token}`).set("X-Tenant-Id", "globex");
    expect((res.body.data as { tenant: string }[]).every((event) => event.tenant === "acme")).toBe(true);
  });

  it("refuses service tokens without a tenant or without the scope", async () => {
    const untenanted = JwtService.sign({ service: "legacy", scopes: ["events:read"], type: "service" }, "5m", SERVICE_JWT_SECRET);
    expect((await api().get("/api/internal/events").set("Authorization", `Bearer ${untenanted}`)).status).toBe(403);

    const unscoped = createServiceToken("reporting", [], "acme");
    expect((await api().get("/api/internal/events").set("Authorization", `Bearer ${unscoped}`)).status).toBe(403);
  });
});
