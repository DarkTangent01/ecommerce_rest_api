import { createHash } from "node:crypto";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { IdempotencyKey, Order } from "../../src/models/index.js";
import OrderService from "../../src/services/OrderService.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, address, api, createProduct, createUser } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());
afterEach(() => vi.restoreAllMocks());

const send = (auth: Record<string, string>, key: string) =>
  api().post("/api/orders/checkout").set(auth).set("Idempotency-Key", key).send({ shippingAddress: address });

describe("idempotent checkout (audit H3)", () => {
  it("replays the stored response for a repeated key and creates one order", async () => {
    const { auth } = await createUser();
    await addToCart(auth, (await createProduct())._id);
    const key = "replay-key-0123456789";

    const first = await send(auth, key);
    const second = await send(auth, key);
    expect(first.status).toBe(201);
    expect(second.status).toBe(201);
    expect(second.body.data._id).toBe(first.body.data._id);
    expect(await Order.countDocuments()).toBe(1);
  });

  it("releases the key after a 5xx so the client can retry (was stuck on 429 for 24h)", async () => {
    const { auth } = await createUser();
    await addToCart(auth, (await createProduct())._id);
    const key = "retry-after-500-0123456789";

    const spy = vi.spyOn(OrderService.prototype, "executeCheckout").mockRejectedValueOnce(new Error("db hiccup"));
    expect((await send(auth, key)).status).toBe(500);
    expect(await IdempotencyKey.countDocuments({ key })).toBe(0);

    spy.mockRestore();
    expect((await send(auth, key)).status).toBe(201);
  });

  it("still answers when persisting the key fails, without an unhandled rejection", async () => {
    const { auth } = await createUser();
    await addToCart(auth, (await createProduct())._id);
    vi.spyOn(IdempotencyKey.prototype, "save").mockRejectedValue(new Error("write failed"));

    const res = await send(auth, "persist-fails-0123456789");
    expect(res.status).toBe(201);
  });

  it("does not let an abandoned 'processing' key block retries forever", async () => {
    const { auth, user } = await createUser();
    await addToCart(auth, (await createProduct())._id);
    const processingKey = (key: string, ageMs: number) =>
      IdempotencyKey.collection.insertOne({
        key,
        user: user._id,
        route: "/orders/checkout",
        // The middleware hashes the request body exactly as sent.
        requestHash: createHash("sha256").update(JSON.stringify({ shippingAddress: address })).digest("hex"),
        status: "processing",
        expiresAt: new Date(Date.now() + 3600_000),
        createdAt: new Date(Date.now() - ageMs),
      });

    await processingKey("in-flight-key-0123456789", 1_000);
    expect((await send(auth, "in-flight-key-0123456789")).status).toBe(429);

    await processingKey("abandoned-key-0123456789", 10 * 60_000);
    expect((await send(auth, "abandoned-key-0123456789")).status).toBe(201);
  });
});
