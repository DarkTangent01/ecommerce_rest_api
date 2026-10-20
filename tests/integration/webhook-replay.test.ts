import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Order, PaymentEvent, Tenant } from "../../src/models/index.js";
import { signPayload } from "../../src/utils/webhook.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser, TENANT } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

interface Signed {
  payload: string;
  timestamp: string;
  signature: string;
}

const sign = (body: Record<string, unknown>, timestamp = Math.floor(Date.now() / 1000).toString()): Signed => {
  const payload = JSON.stringify(body);
  return { payload, timestamp, signature: signPayload(payload, timestamp) };
};

const deliver = (signed: Signed, { eventId, provider = "manual" }: { eventId: string; provider?: string }) =>
  api()
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json")
    .set("X-Webhook-Event-Id", eventId)
    .set("X-Payment-Provider", provider)
    .set("X-Webhook-Timestamp", signed.timestamp)
    .set("X-Webhook-Signature", signed.signature)
    .send(signed.payload);

const unpaidOrder = async (tenant = TENANT) => {
  const buyer = await createUser({ tenant });
  const product = await createProduct({ tenant });
  await addToCart(buyer.auth, product._id);
  return (await checkout(buyer.auth)).body.data._id as string;
};

describe("webhook replay and provider binding (SEC-11)", () => {
  it("treats a signed body replayed under a new event id or provider as a replay", async () => {
    const orderId = await unpaidOrder();
    const signed = sign({ orderId, type: "payment.failed" });

    expect((await deliver(signed, { eventId: "evt-1" })).body.data).not.toHaveProperty("replay");
    expect((await deliver(signed, { eventId: "evt-attacker" })).body.data).toEqual({ replay: true });
    expect((await deliver(signed, { eventId: "evt-attacker-2", provider: "MANUAL" })).body.data).toEqual({ replay: true });
    expect(await PaymentEvent.countDocuments({ order: orderId })).toBe(1);
  });

  it("still replays a legitimate provider retry of the same event", async () => {
    const orderId = await unpaidOrder();
    expect((await deliver(sign({ orderId, type: "payment.succeeded" }), { eventId: "evt-pay" })).status).toBe(200);
    // Providers re-sign retries with a fresh timestamp; the event id still identifies them.
    const retry = await deliver(sign({ orderId, type: "payment.succeeded" }, String(Math.floor(Date.now() / 1000) + 1)), { eventId: "evt-pay" });
    expect(retry.body.data).toEqual({ replay: true });
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: "paid" });
  });

  it("rejects providers that are not configured", async () => {
    const orderId = await unpaidOrder();
    const res = await deliver(sign({ orderId, type: "payment.succeeded" }), { eventId: "evt-x", provider: "evil-pay" });
    expect(res.status).toBe(401);
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: "unpaid" });
  });

  it("rejects tampered bodies, bad signatures and expired timestamps", async () => {
    const orderId = await unpaidOrder();
    const signed = sign({ orderId, type: "payment.failed" });

    const tampered = { ...signed, payload: JSON.stringify({ orderId, type: "payment.succeeded" }) };
    expect((await deliver(tampered, { eventId: "evt-t" })).status).toBe(401);
    expect((await deliver({ ...signed, signature: "00".repeat(32) }, { eventId: "evt-s" })).status).toBe(401);
    expect((await deliver(sign({ orderId, type: "payment.succeeded" }, String(Math.floor(Date.now() / 1000) - 3600)), { eventId: "evt-old" })).status).toBe(401);
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: "unpaid" });
  });

  it("refuses to settle an order of a tenant that uses a different provider", async () => {
    await Tenant.create({ key: "globex", name: "Globex", status: "active", config: { paymentProvider: "stripe" } });
    const orderId = await unpaidOrder("globex");

    const res = await deliver(sign({ orderId, type: "payment.succeeded" }), { eventId: "evt-cross" });
    expect(res.status).toBe(404);
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: "unpaid" });
  });
});
