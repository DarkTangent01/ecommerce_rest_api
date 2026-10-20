import fs from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Order, Review } from "../../src/models/index.js";
import { cache } from "../../src/utils/cache.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { address, api, createProduct, createUser, TENANT } from "../helpers/factories.js";

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0x00, 0x01, 0xff, 0xd9]);
const uploaded: string[] = [];

beforeAll(() => startDb());
afterAll(async () => {
  await Promise.all(uploaded.map((file) => fs.rm(path.join(process.cwd(), file), { force: true })));
  await stopDb();
});
beforeEach(async () => {
  await clearDb();
  await cache.del("products:");
});

const createViaApi = (auth: Record<string, string>, fields: Record<string, string>) => {
  const req = api().post("/api/products").set(auth);
  for (const [key, value] of Object.entries(fields)) void req.field(key, value);
  return req.attach("image", JPEG, { filename: "p.jpg", contentType: "image/jpeg" });
};

const trackUpload = (imageUrl: string) => uploaded.push(new URL(imageUrl).pathname.replace(/^\/+/, ""));

describe("product catalogue", () => {
  it("lets a seller create a product from a multipart form", async () => {
    const { auth, user } = await createUser({ role: "seller" });
    const res = await createViaApi(auth, { name: "Mug", price: "9.99", stock: "4", category: "kitchen", sku: "mug-1" });
    expect(res.status).toBe(201);
    trackUpload(res.body.data.image);
    expect(res.body.data).toMatchObject({ name: "Mug", price: 9.99, stock: 4, sku: "MUG-1", seller: String(user._id) });
  });

  it("answers a duplicate SKU with 409 instead of 500 (audit M14)", async () => {
    const { auth } = await createUser({ role: "seller" });
    const first = await createViaApi(auth, { name: "Mug", price: "5", sku: "DUP-1" });
    trackUpload(first.body.data.image);
    const second = await createViaApi(auth, { name: "Mug 2", price: "5", sku: "DUP-1" });
    expect(second.status).toBe(409);
    expect(second.body.error.code).toBe("CONFLICT");
  });

  it("forbids plain users from creating products", async () => {
    const { auth } = await createUser();
    expect((await createViaApi(auth, { name: "Nope", price: "1" })).status).toBe(403);
  });

  it("lists active products for the tenant with pagination metadata", async () => {
    await Promise.all([createProduct(), createProduct(), createProduct(), createProduct({ tenant: "other" })]);
    const res = await api().get("/api/products").query({ limit: 2 }).set("X-Tenant-Id", TENANT);
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ page: 1, limit: 2, total: 3, pages: 2 });
  });

  it("filters by several categories (an array used to match nothing)", async () => {
    const [a, b] = await Promise.all([createProduct(), createProduct(), createProduct()]);
    const { Product } = await import("../../src/models/index.js");
    await Product.updateOne({ _id: a._id }, { $set: { category: "tea" } });
    await Product.updateOne({ _id: b._id }, { $set: { category: "coffee" } });

    const res = await api().get("/api/products?category=tea&category=coffee").set("X-Tenant-Id", TENANT);
    expect(res.body.data.map((p: { _id: string }) => p._id).sort()).toEqual([String(a._id), String(b._id)].sort());
  });

  it("searches names case-insensitively and treats regex characters literally", async () => {
    const product = await createProduct();
    const res = await api().get("/api/products").query({ q: product.name.toUpperCase() }).set("X-Tenant-Id", TENANT);
    expect(res.body.data).toHaveLength(1);
    expect((await api().get("/api/products").query({ q: ".*" }).set("X-Tenant-Id", TENANT)).body.data).toHaveLength(0);
  });

  it("shows a single product and 404s for another tenant's", async () => {
    const product = await createProduct();
    expect((await api().get(`/api/products/${String(product._id)}`).set("X-Tenant-Id", TENANT)).status).toBe(200);
    expect((await api().get(`/api/products/${String(product._id)}`).set("X-Tenant-Id", "other")).status).toBe(404);
  });
});

describe("product list cache (audit M10)", () => {
  it("ignores parameters that do not affect the result", async () => {
    await createProduct();
    const before = cache.size();
    for (let i = 0; i < 20; i += 1) {
      await api().get("/api/products").query({ junk: String(i) }).set("X-Tenant-Id", TENANT);
    }
    expect(cache.size() - before).toBe(1);
  });

  it("evicts least-recently-used entries beyond CACHE_MAX_ENTRIES", async () => {
    for (let i = 0; i < 1100; i += 1) await cache.set(`bound-test:${i}`, i);
    expect(cache.size()).toBeLessThanOrEqual(1000);
    expect(await cache.get("bound-test:1099")).toBe(1099);
    expect(await cache.get("bound-test:0")).toBeNull();
  });
});

describe("reviews (audit M9)", () => {
  it("paginates the review list", async () => {
    const product = await createProduct();
    const reviewers = await Promise.all(Array.from({ length: 3 }, () => createUser()));
    await Review.insertMany(reviewers.map(({ user }) => ({ user: user._id, product: product._id, tenant: TENANT, rating: 5 })));

    const res = await api().get(`/api/products/${String(product._id)}/reviews`).query({ limit: 2 }).set("X-Tenant-Id", TENANT);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta).toMatchObject({ total: 3, pages: 2 });
  });

  it("only lets verified purchasers review", async () => {
    const product = await createProduct();
    const { auth, user } = await createUser();
    const body = { rating: 4, title: "Good" };
    expect((await api().post(`/api/products/${String(product._id)}/reviews`).set(auth).send(body)).status).toBe(403);

    await Order.create({
      user: user._id,
      tenant: TENANT,
      items: [{ product: product._id, name: product.name, price: product.price, quantity: 1 }],
      total: product.price,
      status: "delivered",
      paymentStatus: "paid",
      shippingAddress: address,
    });
    const res = await api().post(`/api/products/${String(product._id)}/reviews`).set(auth).send(body);
    expect(res.status).toBe(201);
    expect((await api().get(`/api/products/${String(product._id)}`).set("X-Tenant-Id", TENANT)).body.data).toMatchObject({ ratingAverage: 4, ratingCount: 1 });
  });
});
