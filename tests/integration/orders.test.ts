import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { Coupon, DomainEvent, InventoryReservation, Order, Product } from "../../src/models/index.js";
import OrderService from "../../src/services/OrderService.js";
import { EXPIRED_ORDER_REASON, releaseExpiredReservations } from "../../src/services/inventoryService.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser, TENANT } from "../helpers/factories.js";

beforeAll(() => startDb({ replSet: true }));
afterAll(() => stopDb());
beforeEach(() => clearDb());
afterEach(() => vi.restoreAllMocks());

describe("checkout (replica set, transactional)", () => {
  it("reserves stock, creates the order and empties the cart", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ price: 12.5, stock: 5 });
    await addToCart(auth, product._id, 2);

    const res = await checkout(auth);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ total: 25, status: "pending", paymentStatus: "unpaid" });
    expect((await Product.findById(product._id))!.stock).toBe(3);
    expect(await InventoryReservation.countDocuments({ order: res.body.data._id, status: "reserved" })).toBe(1);
    expect((await api().get("/api/cart").set(auth)).body.data.items).toEqual([]);
  });

  it("returns the committed order even if post-commit side effects fail (audit H4)", async () => {
    vi.spyOn(OrderService.prototype, "afterCheckout").mockRejectedValue(new Error("saga store down"));
    const { auth } = await createUser();
    const product = await createProduct({ stock: 1 });
    await addToCart(auth, product._id);

    const res = await checkout(auth);
    expect(res.status).toBe(201);
    expect(await Order.exists({ _id: res.body.data._id })).toBeTruthy();
  });

  it("never lets concurrent checkouts exceed a coupon's usage limit", async () => {
    await Coupon.create({ code: "ONCE", type: "fixed", value: 1, usageLimit: 1, perUserLimit: 1, tenant: TENANT });
    const product = await createProduct({ stock: 10 });
    const buyers = await Promise.all([createUser(), createUser(), createUser()]);
    for (const { auth } of buyers) await addToCart(auth, product._id);

    const results = await Promise.all(buyers.map(({ auth }) => checkout(auth, { couponCode: "ONCE" })));
    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    expect((await Coupon.findOne({ code: "ONCE" }))!.usedCount).toBe(1);
  });
});

describe("money math (audit H11)", () => {
  it("computes exact totals instead of float sums", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ price: 0.1, stock: 10 });
    await addToCart(auth, product._id, 3);
    const res = await checkout(auth);
    // Previously 0.30000000000000004.
    expect(res.body.data).toMatchObject({ subtotal: 0.3, total: 0.3 });
  });

  it("rounds percentage discounts to the cent", async () => {
    await Coupon.create({ code: "TEN", type: "percentage", value: 10, usageLimit: 5, perUserLimit: 1, tenant: TENANT });
    const { auth } = await createUser();
    const product = await createProduct({ price: 19.99, stock: 10 });
    await addToCart(auth, product._id, 3);
    const res = await checkout(auth, { couponCode: "TEN" });
    // Previously discountTotal 5.997 and total 53.973.
    expect(res.body.data).toMatchObject({ subtotal: 59.97, discountTotal: 6, total: 53.97 });
  });
});

describe("cancellation", () => {
  it("returns stock exactly once when cancel is called concurrently", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ stock: 4 });
    await addToCart(auth, product._id, 3);
    const orderId = (await checkout(auth)).body.data._id as string;

    const results = await Promise.all(
      [1, 2, 3].map(() => api().post(`/api/orders/${orderId}/cancel`).set(auth).send({ reason: "changed my mind" }))
    );
    expect(results.filter((r) => r.status === 200)).toHaveLength(1);
    expect(results.filter((r) => r.status !== 200).every((r) => r.status === 400 || r.status === 409)).toBe(true);
    expect((await Product.findById(product._id))!.stock).toBe(4);
  });
});

describe("expired reservations (audit C2)", () => {
  it("does not declare a TTL index that would silently delete reservations", async () => {
    const indexes = await InventoryReservation.collection.indexes();
    expect(indexes.filter((index) => index.expireAfterSeconds !== undefined)).toEqual([]);
  });

  it("returns stock and cancels the unpaid order once the payment window passes", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ stock: 2 });
    await addToCart(auth, product._id, 2);
    const orderId = (await checkout(auth)).body.data._id as string;
    expect((await Product.findById(product._id))!.stock).toBe(0);

    const later = new Date(Date.now() + 60 * 60 * 1000);
    expect(await releaseExpiredReservations(later)).toEqual({ released: 1, cancelled: 1 });

    expect((await Product.findById(product._id))!.stock).toBe(2);
    expect(await Order.findById(orderId)).toMatchObject({ status: "cancelled", cancellationReason: EXPIRED_ORDER_REASON });
    expect(await InventoryReservation.findOne({ order: orderId })).toMatchObject({ status: "expired" });

    // Idempotent: a second sweep changes nothing.
    expect(await releaseExpiredReservations(later)).toEqual({ released: 0, cancelled: 0 });
    expect((await Product.findById(product._id))!.stock).toBe(2);
  });

  it("commits instead of releasing when the order was paid before the sweep", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ stock: 1 });
    await addToCart(auth, product._id);
    const orderId = (await checkout(auth)).body.data._id as string;
    await Order.updateOne({ _id: orderId }, { $set: { paymentStatus: "paid", status: "confirmed" } });

    await releaseExpiredReservations(new Date(Date.now() + 60 * 60 * 1000));
    expect((await Product.findById(product._id))!.stock).toBe(0);
    expect(await InventoryReservation.findOne({ order: orderId })).toMatchObject({ status: "committed" });
  });

  it("expires every overdue order in one sweep (SEC-12: only one order.cancelled event could ever be stored)", async () => {
    const product = await createProduct({ stock: 3 });
    for (let i = 0; i < 3; i++) {
      const { auth } = await createUser();
      await addToCart(auth, product._id);
      expect((await checkout(auth)).status).toBe(201);
    }

    expect(await releaseExpiredReservations(new Date(Date.now() + 60 * 60 * 1000))).toEqual({ released: 3, cancelled: 3 });
    expect((await Product.findById(product._id))!.stock).toBe(3);
    expect(await DomainEvent.countDocuments({ type: "order.cancelled" })).toBe(3);
  });

  it("keeps sweeping when publishing an event fails (SEC-12)", async () => {
    const product = await createProduct({ stock: 2 });
    for (let i = 0; i < 2; i++) {
      const { auth } = await createUser();
      await addToCart(auth, product._id);
      await checkout(auth);
    }
    vi.spyOn(DomainEvent, "create").mockRejectedValue(new Error("event store down"));

    expect(await releaseExpiredReservations(new Date(Date.now() + 60 * 60 * 1000))).toEqual({ released: 2, cancelled: 2 });
    expect((await Product.findById(product._id))!.stock).toBe(2);
  });
});

describe("domain events (SEC-12)", () => {
  it("lets any number of un-keyed events of one type coexist, but keeps keyed ones unique", async () => {
    const base = { type: "order.cancelled", aggregateType: "order" };
    await DomainEvent.create(base);
    await DomainEvent.create(base);
    expect(await DomainEvent.countDocuments(base)).toBe(2);

    await DomainEvent.create({ ...base, idempotencyKey: "k-1" });
    await expect(DomainEvent.create({ ...base, idempotencyKey: "k-1" })).rejects.toMatchObject({ code: 11000 });
  });

  it("returns 200 for every user's cancellation, not 409 after the first one", async () => {
    const product = await createProduct({ stock: 2 });
    for (let i = 0; i < 2; i++) {
      const { auth } = await createUser();
      await addToCart(auth, product._id);
      const orderId = (await checkout(auth)).body.data._id as string;
      const res = await api().post(`/api/orders/${orderId}/cancel`).set(auth).send({ reason: "changed my mind" });
      expect(res.status).toBe(200);
    }
  });
});
