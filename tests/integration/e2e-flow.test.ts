import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { startDb, stopDb } from "../helpers/db.js";
import { address, api, createUser, idempotencyKey, TENANT } from "../helpers/factories.js";
import { sendWebhook } from "../helpers/webhooks.js";

// The original end-to-end script (register -> sell -> buy -> pay -> ship -> report), now running
// against an in-memory replica set instead of a developer's local MongoDB.

let uploadedImage: string | undefined;

beforeAll(() => startDb());
afterAll(async () => {
  if (uploadedImage) await fs.rm(path.join(process.cwd(), new URL(uploadedImage).pathname.replace(/^\/+/, "")), { force: true });
  await stopDb();
});

describe("end-to-end commerce flow", () => {
  it("registers, sells, buys, pays, ships and reports", async () => {
    const tenant = { "X-Tenant-Id": TENANT };
    const email = `runtime-${Date.now()}@example.com`;

    const registered = await api().post("/api/register").set(tenant).send({ name: "Runtime User", email, password: "Password123", repeat_password: "Password123" });
    expect(registered.status).toBe(201);
    const userAuth = { ...tenant, Authorization: `Bearer ${registered.body.data.access_token as string}` };

    const refreshed = await api().post("/api/refresh").send({ refresh_token: registered.body.data.refresh_token });
    expect(refreshed.status).toBe(200);

    const admin = await createUser({ role: "admin" });
    const seller = await createUser({ role: "seller" });

    const created = await api()
      .post("/api/products")
      .set(seller.auth)
      .field("name", "Runtime Product")
      .field("price", "25")
      .field("stock", "5")
      .field("category", "runtime")
      .attach("image", Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x01, 0xff, 0xd9]), { filename: "product.jpg", contentType: "image/jpeg" });
    expect(created.status).toBe(201);
    const productId = created.body.data._id as string;
    uploadedImage = created.body.data.image as string;

    const listed = await api().get("/api/products").set(tenant);
    expect(listed.body.data.map((p: { _id: string }) => p._id)).toContain(productId);

    expect((await api().post("/api/cart/items").set(userAuth).send({ productId, quantity: 1 })).status).toBe(200);
    expect((await api().post(`/api/wishlist/${productId}`).set(userAuth)).status).toBe(200);

    const coupon = await api().post("/api/coupons").set(admin.auth).send({ code: "SAVE5", type: "fixed", value: 5, usageLimit: 5, perUserLimit: 1 });
    expect(coupon.status).toBe(201);

    const key = idempotencyKey();
    const order = await api().post("/api/orders/checkout").set(userAuth).set("Idempotency-Key", key).send({ couponCode: "SAVE5", shippingAddress: address });
    expect(order.status).toBe(201);
    expect(order.body.data).toMatchObject({ subtotal: 25, discountTotal: 5, total: 20 });
    const orderId = order.body.data._id as string;

    const replay = await api().post("/api/orders/checkout").set(userAuth).set("Idempotency-Key", key).send({ couponCode: "SAVE5", shippingAddress: address });
    expect(replay.status).toBe(201);
    expect(replay.body.data._id).toBe(orderId);

    const paid = await sendWebhook({ orderId, type: "payment.succeeded", paymentReference: "pay_runtime" });
    expect(paid.status).toBe(200);
    expect(paid.body.data.paymentStatus).toBe("paid");

    const shipped = await api()
      .put(`/api/orders/${orderId}/shipment`)
      .set(seller.auth)
      .send({ carrier: "Runtime Carrier", trackingNumber: "TRK1", trackingUrl: "https://example.com/tracking", status: "in_transit" });
    expect(shipped.status).toBe(200);

    const analytics = await api().get("/api/admin/analytics").set(admin.auth);
    expect(analytics.status).toBe(200);
    expect(analytics.body.data).toMatchObject({ orders: 1, revenue: 20 });

    const loggedOut = await api().post("/api/logout").set(userAuth).send({ refresh_token: refreshed.body.data.refresh_token });
    expect(loggedOut.status).toBe(200);
  });
});
