import assert from "assert";
import fs from "fs";
import os from "os";
import path from "path";

import { registerSchema, loginSchema, productSchema } from "../validators/index.js";
import { buildPagination, buildSort } from "../utils/pagination.js";
import CustomeErrorHandler from "../services/CustomeErrorHandler.js";
import authorize from "../middlewares/authorize.js";
import { pickAllowedFields } from "../utils/fieldPolicy.js";
import { assertPaymentTransition } from "../services/paymentStateMachine.js";
import { signPayload, verifyWebhookSignature } from "../utils/webhook.js";
import { assertSafeExternalUrl } from "../utils/ssrf.js";
import { assertSafeImage } from "../controllers/productsContollers/productContoller.js";
import { createServiceToken } from "../infra/serviceClient.js";
import { JwtService } from "../services/index.js";
import { SERVICE_JWT_SECRET } from "../config/index.js";
import { createSignedUrl, verifySignedUrl } from "../services/securityService.js";
import { serviceBoundaryForRoute } from "../architecture/services.js";
import { withDistributedLock } from "../infra/locks/distributedLock.js";

const weakRegistration = registerSchema.validate({
  name: "A User",
  email: "a@example.com",
  password: "password",
  repeat_password: "password",
});
assert(weakRegistration.error, "weak passwords must be rejected");

const validLogin = loginSchema.validate({
  email: "ADMIN@EXAMPLE.COM",
  password: "AnyLongEnoughPassword",
  role: "admin",
});
assert.strictEqual(validLogin.error, undefined);
assert.strictEqual(validLogin.value.email, "admin@example.com");
assert.strictEqual(validLogin.value.role, undefined, "unknown fields must be stripped");

const product = productSchema.validate({
  name: "Test product",
  price: 20,
  stock: 3,
  unsafe: "nope",
});
assert.strictEqual(product.error, undefined);
assert.strictEqual(product.value.unsafe, undefined);

const pagination = buildPagination({ page: "-1", limit: "500" });
assert.deepStrictEqual(pagination, { page: 1, limit: 100, skip: 0 });
assert.strictEqual(buildSort("price", "desc", ["price"]), "-price");
assert.strictEqual(buildSort("$where", "desc", ["price"]), "-createdAt");

assert.strictEqual(CustomeErrorHandler.forbidden("<script>").message, "script");

const sellerProductFields = pickAllowedFields("product", "seller", {
  name: "Seller product",
  stock: 3,
  isActive: false,
});
assert.deepStrictEqual(sellerProductFields, { name: "Seller product", stock: 3 }, "seller must not write admin-only fields");

let forbiddenCalled = false;
authorize("admin")({ user: { role: "seller" } }, {}, (err) => {
  forbiddenCalled = err?.status === 403;
});
assert.strictEqual(forbiddenCalled, true, "seller must be blocked from admin route");

assert.doesNotThrow(() => assertPaymentTransition("unpaid", "paid"));
assert.throws(() => assertPaymentTransition("refunded", "paid"), /Invalid payment transition/);

const payload = JSON.stringify({ orderId: "507f1f77bcf86cd799439011", type: "payment.succeeded" });
const timestamp = Math.floor(Date.now() / 1000).toString();
const signature = signPayload(payload, timestamp);
assert.doesNotThrow(() => verifyWebhookSignature(payload, signature, timestamp));
assert.throws(() => verifyWebhookSignature(payload, signature, "1"), /Stale webhook/);

assert.throws(() => assertSafeExternalUrl("http://127.0.0.1/admin"), /Only HTTPS|Private network/);
assert.throws(() => assertSafeExternalUrl("https://localhost/admin"), /Private network/);
assert.doesNotThrow(() => assertSafeExternalUrl("https://example.com/tracking"));

const tmpFile = path.join(os.tmpdir(), `unsafe-upload-${Date.now()}.jpg`);
fs.writeFileSync(tmpFile, Buffer.from("MZ fake executable"));
await assert.rejects(() => assertSafeImage({ path: tmpFile }), /Invalid or unsafe image upload/);

const serviceToken = createServiceToken("order", ["events:read"]);
const servicePayload = JwtService.verify(serviceToken, SERVICE_JWT_SECRET);
assert.strictEqual(servicePayload.type, "service");
assert.deepStrictEqual(servicePayload.scopes, ["events:read"]);

const signedUrl = createSignedUrl({ path: "/uploads/private.jpg", tenant: "default", subject: "user-1", ttlSeconds: 60 });
const parsedUrl = new URL(`https://example.com${signedUrl}`);
assert.strictEqual(
  verifySignedUrl({
    path: "/uploads/private.jpg",
    tenant: parsedUrl.searchParams.get("tenant"),
    subject: parsedUrl.searchParams.get("subject"),
    expires: parsedUrl.searchParams.get("expires"),
    signature: parsedUrl.searchParams.get("signature"),
  }),
  true
);

assert.strictEqual(serviceBoundaryForRoute("/orders/checkout"), "order");
assert.strictEqual(serviceBoundaryForRoute("/payments/webhook"), "payment");

let lockEntered = false;
await withDistributedLock("test-lock", 1000, async () => {
  lockEntered = true;
});
assert.strictEqual(lockEntered, true);

console.log("Security smoke tests passed.");
