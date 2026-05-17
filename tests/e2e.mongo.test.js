import assert from "assert";
import crypto from "crypto";
import fs from "fs/promises";
import mongoose from "mongoose";
import { app, connectDatabase } from "../server.js";
import { User } from "../models/index.js";
import { signPayload } from "../utils/webhook.js";

const baseEnv = {
  DB_URL: process.env.DB_URL || "mongodb://127.0.0.1:27017/ecommerce_rest_api_validation_runtime",
  JWT_SECRET: process.env.JWT_SECRET || "validation-access-secret-validation-access-secret",
  REFRESH_SECRET: process.env.REFRESH_SECRET || "validation-refresh-secret-validation-refresh-secret",
  WEBHOOK_SECRET: process.env.WEBHOOK_SECRET || "validation-webhook-secret-validation-webhook-secret",
};

Object.assign(process.env, baseEnv);

await connectDatabase();
await mongoose.connection.db.dropDatabase();

const server = app.listen(0);
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}/api`;
const tenant = `tenant-${Date.now()}`;
let uploadedImagePath;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "X-Tenant-Id": tenant,
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
};

const authHeader = (token) => ({ Authorization: `Bearer ${token}` });
const localUploadPath = (imageUrl) => {
  if (!imageUrl) return null;
  try {
    const parsed = new URL(imageUrl);
    return parsed.pathname.replace(/^\/+/, "");
  } catch {
    return imageUrl;
  }
};

try {
  const suffix = crypto.randomBytes(4).toString("hex");
  let result = await request("/register", {
    method: "POST",
    body: JSON.stringify({
      name: "Runtime User",
      email: `runtime-${suffix}@example.com`,
      password: "Password123",
      repeat_password: "Password123",
    }),
  });
  assert.strictEqual(result.response.status, 201, JSON.stringify(result.body));
  const userAccess = result.body.data.access_token;
  const userRefresh = result.body.data.refresh_token;

  result = await request("/refresh", {
    method: "POST",
    body: JSON.stringify({ refresh_token: userRefresh }),
  });
  assert.strictEqual(result.response.status, 200, JSON.stringify(result.body));

  const admin = await User.create({
    name: "Runtime Admin",
    email: `admin-${suffix}@example.com`,
    password: "not-used",
    role: "admin",
    tenant,
  });
  const seller = await User.create({
    name: "Runtime Seller",
    email: `seller-${suffix}@example.com`,
    password: "not-used",
    role: "seller",
    tenant,
  });
  const { JwtService } = await import("../services/index.js");
  const adminToken = JwtService.sign({ _id: admin._id, role: "admin" });
  const sellerToken = JwtService.sign({ _id: seller._id, role: "seller" });

  const image = new Blob([Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x01, 0xff, 0xd9])], { type: "image/jpeg" });
  const form = new FormData();
  form.set("name", "Runtime Product");
  form.set("price", "25");
  form.set("stock", "5");
  form.set("category", "runtime");
  form.set("image", image, "product.jpg");
  result = await request("/products", {
    method: "POST",
    headers: authHeader(sellerToken),
    body: form,
  });
  assert.strictEqual(result.response.status, 201, JSON.stringify(result.body));
  const productId = result.body.data._id;
  uploadedImagePath = result.body.data.image;

  result = await request("/products");
  assert.strictEqual(result.response.status, 200);
  assert(result.body.data.some((product) => product._id === productId));

  result = await request("/cart/items", {
    method: "POST",
    headers: authHeader(userAccess),
    body: JSON.stringify({ productId, quantity: 1 }),
  });
  assert.strictEqual(result.response.status, 200, JSON.stringify(result.body));

  result = await request(`/wishlist/${productId}`, {
    method: "POST",
    headers: authHeader(userAccess),
  });
  assert.strictEqual(result.response.status, 200, JSON.stringify(result.body));

  result = await request("/coupons", {
    method: "POST",
    headers: authHeader(adminToken),
    body: JSON.stringify({
      code: `SAVE${suffix}`,
      type: "fixed",
      value: 5,
      usageLimit: 5,
      perUserLimit: 1,
    }),
  });
  assert.strictEqual(result.response.status, 201, JSON.stringify(result.body));

  result = await request("/orders/checkout", {
    method: "POST",
    headers: { ...authHeader(userAccess), "Idempotency-Key": `idem-${suffix}-1234567890` },
    body: JSON.stringify({
      couponCode: `SAVE${suffix}`,
      shippingAddress: {
        line1: "221B Baker Street",
        city: "London",
        state: "London",
        postalCode: "NW1",
        country: "UK",
      },
    }),
  });
  assert.strictEqual(result.response.status, 201, JSON.stringify(result.body));
  const orderId = result.body.data._id;

  result = await request("/orders/checkout", {
    method: "POST",
    headers: { ...authHeader(userAccess), "Idempotency-Key": `idem-${suffix}-1234567890` },
    body: JSON.stringify({
      couponCode: `SAVE${suffix}`,
      shippingAddress: {
        line1: "221B Baker Street",
        city: "London",
        state: "London",
        postalCode: "NW1",
        country: "UK",
      },
    }),
  });
  assert.strictEqual(result.response.status, 201, "idempotent checkout should replay original response");
  assert.strictEqual(result.body.data._id, orderId);

  const webhookPayload = JSON.stringify({ orderId, type: "payment.succeeded", paymentReference: `pay_${suffix}` });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  result = await request("/payments/webhook", {
    method: "POST",
    headers: {
      "X-Webhook-Event-Id": `evt_${suffix}`,
      "X-Webhook-Timestamp": timestamp,
      "X-Webhook-Signature": signPayload(webhookPayload, timestamp),
    },
    body: webhookPayload,
  });
  assert.strictEqual(result.response.status, 200, JSON.stringify(result.body));
  assert.strictEqual(result.body.data.paymentStatus, "paid");

  result = await request(`/orders/${orderId}/shipment`, {
    method: "PUT",
    headers: authHeader(sellerToken),
    body: JSON.stringify({
      carrier: "Runtime Carrier",
      trackingNumber: `TRK${suffix}`,
      trackingUrl: "https://example.com/tracking",
      status: "in_transit",
    }),
  });
  assert.strictEqual(result.response.status, 200, JSON.stringify(result.body));

  result = await request("/admin/analytics", { headers: authHeader(adminToken) });
  assert.strictEqual(result.response.status, 200, JSON.stringify(result.body));

  result = await request("/logout", {
    method: "POST",
    headers: authHeader(userAccess),
    body: JSON.stringify({ refresh_token: userRefresh }),
  });
  assert.strictEqual(result.response.status, 200, JSON.stringify(result.body));

  console.log("Mongo E2E flow passed.");
} finally {
  await new Promise((resolve) => server.close(resolve));
  await mongoose.disconnect();
  const cleanupPath = localUploadPath(uploadedImagePath);
  if (cleanupPath) {
    await fs.rm(cleanupPath, { force: true });
  }
}
