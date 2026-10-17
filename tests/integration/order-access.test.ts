import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, checkout, createProduct, createUser, TENANT } from "../helpers/factories.js";
import { sendWebhook } from "../helpers/webhooks.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

const placeOrder = async (tenant = TENANT) => {
  const buyer = await createUser({ tenant });
  await addToCart(buyer.auth, (await createProduct({ tenant }))._id);
  const res = await checkout(buyer.auth);
  expect(res.status).toBe(201);
  return { buyer, orderId: res.body.data._id as string };
};

describe("order history access control", () => {
  it("lets a user see and page through only their own orders", async () => {
    const alice = await placeOrder();
    await placeOrder();

    const res = await api().get("/api/orders").set(alice.buyer.auth);
    expect(res.status).toBe(200);
    expect(res.body.data.map((o: { _id: string }) => o._id)).toEqual([alice.orderId]);
    expect(res.body.meta).toMatchObject({ total: 1, page: 1 });
  });

  it("hides another user's order (404, not 403, so ids cannot be probed)", async () => {
    const alice = await placeOrder();
    const bob = await createUser();

    expect((await api().get(`/api/orders/${alice.orderId}`).set(bob.auth)).status).toBe(404);
    expect((await api().post(`/api/orders/${alice.orderId}/cancel`).set(bob.auth).send({ reason: "x" })).status).toBe(404);
    await sendWebhook({ orderId: alice.orderId, type: "payment.succeeded" });
    expect((await api().post(`/api/orders/${alice.orderId}/refund`).set(bob.auth).send({ reason: "x" })).status).toBe(404);
    expect((await api().get(`/api/orders/${alice.orderId}`).set(alice.buyer.auth)).status).toBe(200);
  });

  it("lets a tenant admin see every order in their tenant but not in others", async () => {
    const local = await placeOrder(TENANT);
    const foreign = await placeOrder("other-tenant");
    const { auth } = await createUser({ role: "admin", tenant: TENANT });

    const list = await api().get("/api/orders").set(auth);
    expect(list.body.data.map((o: { _id: string }) => o._id)).toEqual([local.orderId]);
    expect((await api().get(`/api/orders/${local.orderId}`).set(auth)).status).toBe(200);
    expect((await api().get(`/api/orders/${foreign.orderId}`).set(auth)).status).toBe(404);
  });

  it("does not let a forged X-Tenant-Id header widen access", async () => {
    const foreign = await placeOrder("other-tenant");
    const { auth } = await createUser({ role: "admin", tenant: TENANT });
    const res = await api().get(`/api/orders/${foreign.orderId}`).set(auth).set("X-Tenant-Id", "other-tenant");
    expect(res.status).toBe(404);
  });

  it("requires authentication and a valid id", async () => {
    expect((await api().get("/api/orders")).status).toBe(401);
    const { auth } = await createUser();
    expect((await api().get("/api/orders/not-an-id").set(auth)).status).toBe(400);
  });

  it("caps page size", async () => {
    const { buyer } = await placeOrder();
    const res = await api().get("/api/orders").query({ limit: 10_000 }).set(buyer.auth);
    expect(res.body.meta.limit).toBe(100);
  });
});
