import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { DomainEvent, Order, Product, Shipment } from "../../src/models/index.js";
import { canTransitionOrder, canTransitionRefund } from "../../src/services/orderStateMachine.js";
import { canTransitionShipment } from "../../src/controllers/shipmentController.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser } from "../helpers/factories.js";
import { sendWebhook } from "../helpers/webhooks.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());
afterEach(() => vi.restoreAllMocks());

const DAY = 24 * 60 * 60 * 1000;

const placeOrder = async ({ pay = true, stock = 5 } = {}) => {
  const buyer = await createUser();
  const product = await createProduct({ stock });
  await addToCart(buyer.auth, product._id);
  const orderId = (await checkout(buyer.auth)).body.data._id as string;
  if (pay) expect((await sendWebhook({ orderId, type: "payment.succeeded" })).status).toBe(200);
  return { buyer, product, orderId };
};

const deliver = (orderId: string, deliveredAt = new Date()) => Order.updateOne({ _id: orderId }, { $set: { status: "delivered", deliveredAt } });
const refund = (auth: Record<string, string>, orderId: string) => api().post(`/api/orders/${orderId}/refund`).set(auth).send({ reason: "damaged" });
const cancel = (auth: Record<string, string>, orderId: string) => api().post(`/api/orders/${orderId}/cancel`).set(auth).send({ reason: "changed my mind" });
const eventCount = (type: string) => DomainEvent.countDocuments({ type });

describe("order state machine (SEC-05)", () => {
  it("allows only forward fulfilment transitions", () => {
    expect(canTransitionOrder("pending", "confirmed")).toBe(true);
    expect(canTransitionOrder("confirmed", "shipped")).toBe(true);
    expect(canTransitionOrder("shipped", "delivered")).toBe(true);
    expect(canTransitionOrder("delivered", "shipped")).toBe(false);
    expect(canTransitionOrder("delivered", "refund_requested")).toBe(false);
    expect(canTransitionOrder("shipped", "cancelled")).toBe(false);
    expect(canTransitionOrder("cancelled", "confirmed")).toBe(false);
  });

  it("allows each refund step once", () => {
    expect(canTransitionRefund("none", "requested")).toBe(true);
    expect(canTransitionRefund("requested", "processed")).toBe(true);
    expect(canTransitionRefund("requested", "requested")).toBe(false);
    expect(canTransitionRefund("processed", "requested")).toBe(false);
  });
});

describe("refund requests (SEC-05)", () => {
  it("opens a refund for a delivered order without overwriting its fulfilment status", async () => {
    const { buyer, orderId } = await placeOrder();
    await deliver(orderId);

    const res = await refund(buyer.auth, orderId);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "delivered", refundStatus: "requested", paymentStatus: "paid" });
    expect(await eventCount("refund.requested")).toBe(1);
  });

  it("rejects a second refund request for the same order", async () => {
    const { buyer, orderId } = await placeOrder();
    await deliver(orderId);
    expect((await refund(buyer.auth, orderId)).status).toBe(200);

    const again = await refund(buyer.auth, orderId);
    expect(again.status).toBe(409);
    expect(await eventCount("refund.requested")).toBe(1);
  });

  it("accepts exactly one of several concurrent refund requests", async () => {
    const { buyer, orderId } = await placeOrder();
    await deliver(orderId);
    const statuses = (await Promise.all(Array.from({ length: 5 }, () => refund(buyer.auth, orderId)))).map((res) => res.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect(await eventCount("refund.requested")).toBe(1);
  });

  it("refuses refunds for undelivered, unpaid or out-of-window orders", async () => {
    const shipped = await placeOrder();
    await Order.updateOne({ _id: shipped.orderId }, { $set: { status: "shipped" } });
    expect((await refund(shipped.buyer.auth, shipped.orderId)).status).toBe(400);

    const unpaid = await placeOrder({ pay: false });
    expect((await refund(unpaid.buyer.auth, unpaid.orderId)).status).toBe(400);

    const old = await placeOrder();
    await deliver(old.orderId, new Date(Date.now() - 31 * DAY));
    const res = await refund(old.buyer.auth, old.orderId);
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/refund window/);
    expect(await Order.findById(old.orderId)).toMatchObject({ refundStatus: "none" });
  });

  it("rolls the request back when the refund event cannot be written, so a retry works", async () => {
    const { buyer, orderId } = await placeOrder();
    await deliver(orderId);
    vi.spyOn(DomainEvent, "create").mockRejectedValueOnce(new Error("event store down"));

    expect((await refund(buyer.auth, orderId)).status).toBe(500);
    expect(await Order.findById(orderId)).toMatchObject({ refundStatus: "none" });
    expect((await refund(buyer.auth, orderId)).status).toBe(200);
  });

  it("completes the refund on the provider's refunded webhook, once", async () => {
    const { buyer, orderId } = await placeOrder();
    await deliver(orderId);
    await refund(buyer.auth, orderId);

    const first = await sendWebhook({ orderId, type: "payment.refunded" }, { eventId: "evt_refund_1" });
    expect(first.status).toBe(200);
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: "refunded", refundStatus: "processed", status: "delivered" });

    // Provider retry of the same event is a replay; a refund after completion is not reopened.
    expect((await sendWebhook({ orderId, type: "payment.refunded" }, { eventId: "evt_refund_1" })).body.data).toEqual({ replay: true });
    expect((await refund(buyer.auth, orderId)).status).toBe(409);
  });
});

describe("cancellation (SEC-05)", () => {
  it("cancels a paid order by returning stock once and opening its refund", async () => {
    const { buyer, product, orderId } = await placeOrder({ stock: 3 });
    expect((await Product.findById(product._id))!.stock).toBe(2);

    const res = await cancel(buyer.auth, orderId);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: "cancelled", paymentStatus: "paid", refundStatus: "requested" });
    expect((await Product.findById(product._id))!.stock).toBe(3);
    expect(await eventCount("order.cancelled")).toBe(1);
    expect(await eventCount("refund.requested")).toBe(1);

    expect((await cancel(buyer.auth, orderId)).status).toBe(400);
    expect((await Product.findById(product._id))!.stock).toBe(3);
    expect(await eventCount("refund.requested")).toBe(1);
  });

  it("cancels an unpaid order without opening a refund", async () => {
    const { buyer, orderId } = await placeOrder({ pay: false });
    const res = await cancel(buyer.auth, orderId);
    expect(res.body.data).toMatchObject({ status: "cancelled", refundStatus: "none" });
    expect(await eventCount("refund.requested")).toBe(0);
  });

  it("returns stock once under concurrent cancels of a paid order", async () => {
    const { buyer, product, orderId } = await placeOrder({ stock: 1 });
    const statuses = (await Promise.all(Array.from({ length: 4 }, () => cancel(buyer.auth, orderId)))).map((res) => res.status);
    expect(statuses.filter((status) => status === 200)).toHaveLength(1);
    expect((await Product.findById(product._id))!.stock).toBe(1);
    expect(await eventCount("refund.requested")).toBe(1);
  });

  it("cannot cancel once the order is shipped", async () => {
    const { buyer, orderId } = await placeOrder();
    await Order.updateOne({ _id: orderId }, { $set: { status: "shipped" } });
    expect((await cancel(buyer.auth, orderId)).status).toBe(400);
  });
});

describe("multi-seller shipments (SEC-08)", () => {
  const multiSellerOrder = async () => {
    const sellerA = await createUser({ role: "seller" });
    const sellerB = await createUser({ role: "seller" });
    const admin = await createUser({ role: "admin" });
    const buyer = await createUser();
    const productA = await createProduct({ seller: sellerA.user._id });
    const productB = await createProduct({ seller: sellerB.user._id });
    await addToCart(buyer.auth, productA._id);
    await addToCart(buyer.auth, productB._id);
    const orderId = (await checkout(buyer.auth)).body.data._id as string;
    await sendWebhook({ orderId, type: "payment.succeeded" });
    return { sellerA, sellerB, admin, orderId };
  };
  const ship = (auth: Record<string, string>, orderId: string, status: string, trackingNumber = "TRK") =>
    api().put(`/api/orders/${orderId}/shipment`).set(auth).send({ carrier: "DHL", trackingNumber, status });

  it("does not let one seller deliver the whole order", async () => {
    const { sellerA, sellerB, orderId } = await multiSellerOrder();

    expect((await ship(sellerA.auth, orderId, "delivered", "A-1")).status).toBe(200);
    expect((await Order.findById(orderId))!.status).toBe("confirmed");

    await ship(sellerB.auth, orderId, "in_transit", "B-1");
    expect((await Order.findById(orderId))!.status).toBe("shipped");

    await ship(sellerB.auth, orderId, "delivered", "B-1");
    const delivered = await Order.findById(orderId);
    expect(delivered!.status).toBe("delivered");
    expect(delivered!.deliveredAt).toBeInstanceOf(Date);
  });

  it("keeps each seller's tracking separate", async () => {
    const { sellerA, sellerB, orderId } = await multiSellerOrder();
    await ship(sellerB.auth, orderId, "in_transit", "B-ORIGINAL");
    await ship(sellerA.auth, orderId, "in_transit", "A-OVERWRITE");

    const shipments = await Shipment.find({ order: orderId }).lean();
    expect(shipments).toHaveLength(2);
    expect(shipments.find((s) => String(s.seller) === String(sellerB.user._id))!.trackingNumber).toBe("B-ORIGINAL");
  });

  it("lets an admin ship the whole order", async () => {
    const { admin, orderId } = await multiSellerOrder();
    expect((await ship(admin.auth, orderId, "delivered")).status).toBe(200);
    expect((await Order.findById(orderId))!.status).toBe("delivered");
  });

  it("never moves a delivered shipment backwards", async () => {
    const { sellerA, orderId } = await multiSellerOrder();
    await ship(sellerA.auth, orderId, "delivered");
    expect((await ship(sellerA.auth, orderId, "in_transit")).status).toBe(409);
    expect(canTransitionShipment("in_transit", "label_created")).toBe(false);
    expect(canTransitionShipment("failed", "label_created")).toBe(true);
  });
});
