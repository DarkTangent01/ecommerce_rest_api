import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { InventoryReservation, Order, PaymentEvent, Product } from "../../src/models/index.js";
import { sendWebhook } from "../helpers/webhooks.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser } from "../helpers/factories.js";

// A standalone mongod has no transactions, which is what the checkout fallback path is for.
beforeAll(() => startDb({ replSet: false }));
afterAll(() => stopDb());
beforeEach(() => clearDb());

describe("checkout without transactions", () => {
  it("still creates orders", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ stock: 3 });
    await addToCart(auth, product._id, 1);

    const res = await checkout(auth);
    expect(res.status).toBe(201);
    expect((await Product.findById(product._id))!.stock).toBe(2);
  });

  it("rolls back stock already reserved when a later item is out of stock (audit C3)", async () => {
    const { auth } = await createUser();
    const available = await createProduct({ stock: 5 });
    const scarce = await createProduct({ stock: 1 });
    await addToCart(auth, available._id, 2);
    await addToCart(auth, scarce._id, 1);
    await Product.updateOne({ _id: scarce._id }, { $set: { stock: 0 } });

    const res = await checkout(auth);
    expect(res.status).toBe(400);
    expect((await Product.findById(available._id))!.stock).toBe(5);
    expect(await InventoryReservation.countDocuments({ status: "reserved" })).toBe(0);
    expect(await Order.countDocuments()).toBe(0);
    // The cart is untouched so the user can fix it and retry.
    expect((await api().get("/api/cart").set(auth)).body.data.items).toHaveLength(2);
  });
});

describe("payment webhook without transactions (audit H6)", () => {
  it("confirms the order and records the event exactly once", async () => {
    const { auth } = await createUser();
    await addToCart(auth, (await createProduct())._id);
    const orderId = (await checkout(auth)).body.data._id as string;

    expect((await sendWebhook({ orderId, type: "payment.succeeded" }, { eventId: "evt_sa" })).status).toBe(200);
    expect((await sendWebhook({ orderId, type: "payment.succeeded" }, { eventId: "evt_sa" })).body.data).toEqual({ replay: true });
    expect(await Order.findById(orderId)).toMatchObject({ paymentStatus: "paid", status: "confirmed" });
    expect(await PaymentEvent.countDocuments({ eventId: "evt_sa" })).toBe(1);
  });
});

describe("cancel without transactions (audit H5)", () => {
  it("cancels and returns stock instead of failing with 500", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ stock: 2 });
    await addToCart(auth, product._id, 2);
    const orderId = (await checkout(auth)).body.data._id as string;

    const res = await api().post(`/api/orders/${orderId}/cancel`).set(auth).send({ reason: "duplicate order" });
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("cancelled");
    expect((await Product.findById(product._id))!.stock).toBe(2);
  });
});
