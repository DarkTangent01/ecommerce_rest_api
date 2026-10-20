import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../src/server.js";
import { streamLimiter } from "../../src/controllers/platformController.js";
import { StreamLimiter } from "../../src/infra/sse/streamLimiter.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { createUser } from "../helpers/factories.js";

let server: Server;
let base: string;
const open: AbortController[] = [];

beforeAll(async () => {
  await startDb();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterAll(async () => {
  open.forEach((controller) => controller.abort());
  await new Promise((resolve) => server.close(resolve));
  await stopDb();
});
beforeEach(async () => {
  open.splice(0).forEach((controller) => controller.abort());
  await clearDb();
});

const connect = async (auth: Record<string, string>) => {
  const controller = new AbortController();
  open.push(controller);
  const res = await fetch(`${base}/api/platform/stream`, { headers: auth, signal: controller.signal });
  return { status: res.status, close: () => controller.abort() };
};

const until = async (check: () => boolean) => {
  for (let i = 0; i < 100 && !check(); i++) await new Promise((resolve) => setTimeout(resolve, 20));
  return check();
};

describe("SSE stream limits (SEC-06)", () => {
  it("caps concurrent streams per user and gives each user an independent quota", async () => {
    const alice = await createUser();
    const bob = await createUser();

    const streams = [await connect(alice.auth), await connect(alice.auth), await connect(alice.auth)];
    expect(streams.map((s) => s.status)).toEqual([200, 200, 200]);
    expect((await connect(alice.auth)).status).toBe(429);
    expect((await connect(bob.auth)).status).toBe(200);
  });

  it("frees the slot when the client disconnects, and only once", async () => {
    const alice = await createUser();
    const id = String(alice.user._id);
    const streams = [await connect(alice.auth), await connect(alice.auth), await connect(alice.auth)];
    expect(streamLimiter.countFor(id)).toBe(3);

    streams[0]!.close();
    expect(await until(() => streamLimiter.countFor(id) === 2)).toBe(true);
    expect((await connect(alice.auth)).status).toBe(200);
    expect((await connect(alice.auth)).status).toBe(429);
  });

  it("does not hold a slot for rejected or unauthenticated requests", async () => {
    const alice = await createUser();
    const id = String(alice.user._id);
    for (let i = 0; i < 3; i++) await connect(alice.auth);
    for (let i = 0; i < 3; i++) await connect(alice.auth);
    expect(streamLimiter.countFor(id)).toBe(3);
    expect((await fetch(`${base}/api/platform/stream`)).status).toBe(401);
  });
});

describe("StreamLimiter", () => {
  it("releases idempotently and enforces the global cap", () => {
    const limiter = new StreamLimiter({ perUser: 2, global: 3 });
    const a1 = limiter.acquire("a")!;
    limiter.acquire("a");
    expect(limiter.acquire("a")).toBeNull();
    limiter.acquire("b");
    expect(limiter.acquire("c")).toBeNull();

    a1();
    a1();
    expect(limiter.stats()).toEqual({ total: 2, users: 2 });
    expect(limiter.acquire("c")).not.toBeNull();
  });
});
