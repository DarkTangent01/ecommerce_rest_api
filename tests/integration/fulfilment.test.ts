import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Order } from "../../src/models/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser, TENANT } from "../helpers/factories.js";
import { sendWebhook } from "../helpers/webhooks.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

const sellerOrder = async ({ pay }: { pay: boolean }) => {
  const seller = await createUser({ role: "seller" });
  const buyer = await createUser();
  const product = await createProduct({ seller: seller.user._id });
  await addToCart(buyer.auth, product._id);
  const orderId = (await checkout(buyer.auth)).body.data._id as string;
  if (pay) await sendWebhook({ orderId, type: "payment.succeeded" });
  return { seller, buyer, orderId };
};

const ship = (auth: Record<string, string>, orderId: string, status: string) =>
  api().put(`/api/orders/${orderId}/shipment`).set(auth).send({ carrier: "DHL", trackingNumber: "TRK1", status });

describe("shipments (audit M6)", () => {
  it("refuses to ship an unpaid order", async () => {
    const { seller, orderId } = await sellerOrder({ pay: false });
    expect((await ship(seller.auth, orderId, "in_transit")).status).toBe(409);
    expect((await Order.findById(orderId))!.status).toBe("pending");
  });

  it("refuses to ship a cancelled order", async () => {
    const { seller, buyer, orderId } = await sellerOrder({ pay: true });
    await api().post(`/api/orders/${orderId}/cancel`).set(buyer.auth).send({ reason: "changed mind" });
    expect((await ship(seller.auth, orderId, "in_transit")).status).toBe(409);
  });

  it("maps shipment progress onto the order status", async () => {
    const { seller, orderId } = await sellerOrder({ pay: true });
    expect((await ship(seller.auth, orderId, "label_created")).status).toBe(200);
    expect((await Order.findById(orderId))!.status).toBe("processing");
    await ship(seller.auth, orderId, "in_transit");
    expect((await Order.findById(orderId))!.status).toBe("shipped");
    await ship(seller.auth, orderId, "failed");
    expect((await Order.findById(orderId))!.status).toBe("shipped");
    await ship(seller.auth, orderId, "label_created");
    expect((await Order.findById(orderId))!.status).toBe("shipped");
    await ship(seller.auth, orderId, "delivered");
    expect((await Order.findById(orderId))!.status).toBe("delivered");
  });

  it("still blocks sellers from other sellers' orders", async () => {
    const { orderId } = await sellerOrder({ pay: true });
    const otherSeller = await createUser({ role: "seller" });
    expect((await ship(otherSeller.auth, orderId, "in_transit")).status).toBe(403);
  });
});

describe("admin analytics (audit M5)", () => {
  it("only counts the admin's own tenant", async () => {
    await createProduct({ tenant: TENANT });
    await createProduct({ tenant: "other-tenant" });
    await createUser({ tenant: "other-tenant" });
    const { auth } = await createUser({ role: "admin", tenant: TENANT });

    const res = await api().get("/api/admin/analytics").set(auth);
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ products: 1, users: 1 });
  });
});
