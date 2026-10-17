import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { InventoryReservation, Order, PaymentEvent, Product, SecuritySignal } from "../../src/models/index.js";
import PaymentRepository from "../../src/repositories/PaymentRepository.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser } from "../helpers/factories.js";
import { sendWebhook } from "../helpers/webhooks.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());
afterEach(() => vi.restoreAllMocks());

const placeOrder = async (stock = 5, quantity = 1) => {
  const { auth } = await createUser();
  const product = await createProduct({ stock });
  await addToCart(auth, product._id, quantity);
  const res = await checkout(auth);
  expect(res.status).toBe(201);
  return { auth, product, orderId: res.body.data._id as string };
};

describe("payment webhook", () => {
  it("confirms the order and commits its reservations", async () => {
    const { orderId } = await placeOrder();
    const res = await sendWebhook({ orderId, type: "payment.succeeded", paymentReference: "pay_1" });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ paymentStatus: "paid", status: "confirmed", paymentReference: "pay_1" });
    expect(await InventoryReservation.findOne({ order: orderId })).toMatchObject({ status: "committed" });
  });

  it("replays a duplicate event id without applying it twice", async () => {
    const { orderId } = await placeOrder();
    await sendWebhook({ orderId, type: "payment.succeeded" }, { eventId: "evt_dup" });
    const replay = await sendWebhook({ orderId, type: "payment.succeeded" }, { eventId: "evt_dup" });
    expect(replay.status).toBe(200);
    expect(replay.body.data).toEqual({ replay: true });
    expect((await Order.findById(orderId))!.paymentStateHistory).toHaveLength(1);
  });

  it("returns stock when the payment fails", async () => {
    const { orderId, product } = await placeOrder(3, 2);
    await sendWebhook({ orderId, type: "payment.failed" });
    expect((await Product.findById(product._id))!.stock).toBe(3);
  });

  it("validates the webhook body (audit M15: a bad orderId was a 500)", async () => {
    const res = await sendWebhook({ orderId: "not-an-id", type: "payment.succeeded" });
    expect(res.status).toBe(422);
    expect(res.body.error.details[0].field).toBe("orderId");
  });

  it("does not record the event when the order update fails, so the provider retry is processed (audit H6)", async () => {
    const { orderId } = await placeOrder();
    vi.spyOn(PaymentRepository.prototype, "transitionOrder").mockRejectedValueOnce(new Error("primary stepped down"));

    const failed = await sendWebhook({ orderId, type: "payment.succeeded" }, { eventId: "evt_retry" });
    expect(failed.status).toBe(500);
    expect(await PaymentEvent.countDocuments({ eventId: "evt_retry" })).toBe(0);

    const retried = await sendWebhook({ orderId, type: "payment.succeeded" }, { eventId: "evt_retry" });
    expect(retried.status).toBe(200);
    expect(retried.body.data.paymentStatus).toBe("paid");
  });

  it("applies concurrent success events for one order only once", async () => {
    const { orderId } = await placeOrder();
    const results = await Promise.all(["a", "b", "c"].map((id) => sendWebhook({ orderId, type: "payment.succeeded" }, { eventId: `evt_${id}` })));
    expect(results.every((r) => r.status === 200 || r.status === 409)).toBe(true);
    expect((await Order.findById(orderId))!.paymentStateHistory).toHaveLength(1);
  });
});

describe("payment for a cancelled order (audit H7)", () => {
  it("is rejected with 409 and flagged, instead of marking a stock-less order paid", async () => {
    const { auth, orderId, product } = await placeOrder(2, 2);
    expect((await api().post(`/api/orders/${orderId}/cancel`).set(auth).send({ reason: "no longer needed" })).status).toBe(200);

    const res = await sendWebhook({ orderId, type: "payment.succeeded" });
    expect(res.status).toBe(409);
    expect(await Order.findById(orderId)).toMatchObject({ status: "cancelled", paymentStatus: "unpaid" });
    expect((await Product.findById(product._id))!.stock).toBe(2);
    expect(await SecuritySignal.countDocuments({ type: "payment.on_cancelled_order" })).toBe(1);
  });
});
