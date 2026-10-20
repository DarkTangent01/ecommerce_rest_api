import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Order } from "../../src/models/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

interface DashboardOrder {
  _id: string;
  items: { product: string; name: string; price: number; quantity: number }[];
  sellerSubtotal: number;
  shippingAddress?: { line1: string };
  [key: string]: unknown;
}

const setup = async () => {
  const sellerA = await createUser({ role: "seller" });
  const sellerB = await createUser({ role: "seller" });
  const outsider = await createUser({ role: "seller" });
  const productA = await createProduct({ price: 10, seller: sellerA.user._id });
  const productB = await createProduct({ price: 99, seller: sellerB.user._id });
  await createProduct({ seller: outsider.user._id });
  const customer = await createUser();
  await addToCart(customer.auth, productA._id, 2);
  await addToCart(customer.auth, productB._id, 1);
  const order = (await checkout(customer.auth)).body.data as { _id: string };
  return { sellerA, sellerB, outsider, productA, productB, customer, order };
};

const dashboardOrders = async (auth: Record<string, string>) => {
  const res = await api().get("/api/seller/dashboard").set(auth);
  expect(res.status).toBe(200);
  return res.body.data as { recentOrders: DashboardOrder[]; revenue: number };
};

describe("seller dashboard data exposure (SEC-03)", () => {
  it("shows a seller only its own line items, without customer or payment details", async () => {
    const { sellerA, sellerB, productA, productB, customer, order } = await setup();

    const [a] = (await dashboardOrders(sellerA.auth)).recentOrders;
    expect(a!._id).toBe(order._id);
    expect(a!.items).toEqual([{ product: String(productA._id), name: productA.name, price: 10, quantity: 2 }]);
    expect(a!.sellerSubtotal).toBe(20);
    for (const field of ["user", "total", "subtotal", "coupon", "paymentStateHistory", "paymentReference", "discountTotal"]) {
      expect(a).not.toHaveProperty(field);
    }
    expect(JSON.stringify(a)).not.toContain(String(productB._id));
    expect(JSON.stringify(a)).not.toContain(String(customer.user._id));

    const [b] = (await dashboardOrders(sellerB.auth)).recentOrders;
    expect(b!.items.map((item) => item.product)).toEqual([String(productB._id)]);
  });

  it("reveals the shipping address only once the order is paid and still to be shipped", async () => {
    const { sellerA, order } = await setup();
    expect((await dashboardOrders(sellerA.auth)).recentOrders[0]).not.toHaveProperty("shippingAddress");

    await Order.updateOne({ _id: order._id }, { $set: { paymentStatus: "paid", status: "confirmed" } });
    const paid = await dashboardOrders(sellerA.auth);
    expect(paid.recentOrders[0]!.shippingAddress?.line1).toBeTruthy();
    expect(paid.revenue).toBe(20);

    await Order.updateOne({ _id: order._id }, { $set: { status: "delivered" } });
    expect((await dashboardOrders(sellerA.auth)).recentOrders[0]).not.toHaveProperty("shippingAddress");
  });

  it("does not show a seller orders it has no items in", async () => {
    const { outsider } = await setup();
    expect((await dashboardOrders(outsider.auth)).recentOrders).toEqual([]);
  });

  it("keeps customers out of the seller dashboard", async () => {
    const { customer } = await setup();
    expect((await api().get("/api/seller/dashboard").set(customer.auth)).status).toBe(403);
  });
});
