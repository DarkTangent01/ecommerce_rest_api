import assert from "assert";

import AuthService from "../services/AuthService.js";
import CartService from "../services/CartService.js";
import PaymentService from "../services/PaymentService.js";
import ProductService from "../services/ProductService.js";

const seller = { _id: "seller-1", role: "seller" };

const productWrites = [];
const productService = new ProductService({
  async create(data) {
    productWrites.push(data);
    return { _id: "product-1", ...data };
  },
  async updateOne() {
    return null;
  },
});

const createdProduct = await productService.create({
  value: { name: "Backpack", price: 1200, stock: 5, isActive: false },
  filePath: "uploads/product.jpg",
  user: seller,
  tenant: "tenant-a",
});

assert.strictEqual(createdProduct.seller, "seller-1");
assert.strictEqual(createdProduct.tenant, "tenant-a");
assert.strictEqual(createdProduct.image, "uploads/product.jpg");
assert.strictEqual(productWrites[0].isActive, undefined, "seller product writes must keep admin-only fields out of the service layer");

await assert.rejects(
  () => productService.update({ id: "missing", value: { name: "Missing" }, user: seller, tenant: "tenant-a" }),
  /Product not found/
);

const cartProduct = { _id: "product-1", stock: 3 };
const cartService = new CartService({
  async findProduct() {
    return cartProduct;
  },
  async findRawForUser() {
    return { items: [{ product: "product-1", quantity: 2 }] };
  },
});

await assert.rejects(
  () => cartService.addItem({ userId: "user-1", tenant: "tenant-a", productId: "product-1", quantity: 2 }),
  /Insufficient stock/
);

const paymentService = new PaymentService({
  async findEvent() {
    return { _id: "event-1" };
  },
});
paymentService.verifyWebhook = () => true;

const replay = await paymentService.processWebhook({
  headers: { provider: "test", eventId: "evt-1" },
  body: { orderId: "order-1", type: "payment.succeeded" },
  rawPayload: "{}",
  req: {},
});

assert.deepStrictEqual(replay, { replay: true });
assert.strictEqual(paymentService.targetStateForEvent("payment.refunded"), "refunded");
assert.match(paymentService.hashPayload("{}"), /^[a-f0-9]{64}$/);

const authService = new AuthService({
  async findActiveRefreshToken() {
    return null;
  },
});

await assert.rejects(() => authService.refresh("bad-token"), /Invalid refresh token/);

console.log("OOP service tests passed.");
