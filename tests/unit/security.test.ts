import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import type { Response } from "express";
import { Types } from "mongoose";
import { describe, expect, it } from "vitest";

import { registerSchema, loginSchema, productSchema } from "../../src/validators/index.js";
import { buildPagination, buildSort } from "../../src/utils/pagination.js";
import CustomeErrorHandler from "../../src/services/CustomeErrorHandler.js";
import authorize from "../../src/middlewares/authorize.js";
import { pickAllowedFields } from "../../src/utils/fieldPolicy.js";
import { assertPaymentTransition } from "../../src/services/paymentStateMachine.js";
import { signPayload, verifyWebhookSignature } from "../../src/utils/webhook.js";
import { assertSafeExternalUrl } from "../../src/utils/ssrf.js";
import { assertSafeImage } from "../../src/controllers/productsContollers/productContoller.js";
import { createServiceToken } from "../../src/infra/serviceClient.js";
import { JwtService } from "../../src/services/index.js";
import { SERVICE_JWT_SECRET } from "../../src/config/index.js";
import { createSignedUrl, verifySignedUrl } from "../../src/services/securityService.js";
import { serviceBoundaryForRoute } from "../../src/architecture/services.js";
import { withDistributedLock } from "../../src/infra/locks/distributedLock.js";

describe("validators", () => {
  it("rejects weak passwords", () => {
    const result = registerSchema.validate({
      name: "A User",
      email: "a@example.com",
      password: "password",
      repeat_password: "password",
    });
    expect(result.error).toBeDefined();
  });

  it("normalises login email and strips unknown fields", () => {
    const result = loginSchema.validate({ email: "ADMIN@EXAMPLE.COM", password: "AnyLongEnoughPassword", role: "admin" });
    expect(result.error).toBeUndefined();
    expect(result.value.email).toBe("admin@example.com");
    expect(result.value).not.toHaveProperty("role");
  });

  it("strips unknown product fields", () => {
    const result = productSchema.validate({ name: "Test product", price: 20, stock: 3, unsafe: "nope" });
    expect(result.error).toBeUndefined();
    expect(result.value).not.toHaveProperty("unsafe");
  });
});

describe("pagination and sorting", () => {
  it("clamps page and limit", () => {
    expect(buildPagination({ page: "-1", limit: "500" })).toEqual({ page: 1, limit: 100, skip: 0 });
  });

  it("only sorts by allow-listed fields", () => {
    expect(buildSort("price", "desc", ["price"])).toBe("-price");
    expect(buildSort("$where", "desc", ["price"])).toBe("-createdAt");
  });
});

describe("authorization helpers", () => {
  it("strips markup from error messages", () => {
    expect(CustomeErrorHandler.forbidden("<script>").message).toBe("script");
  });

  it("keeps admin-only product fields away from sellers", () => {
    const fields = pickAllowedFields("product", "seller", { name: "Seller product", stock: 3, isActive: false });
    expect(fields).toEqual({ name: "Seller product", stock: 3 });
  });

  it("blocks a seller from an admin-only route", () => {
    let status: number | undefined;
    const seller = { _id: new Types.ObjectId(), role: "seller" as const, email: "s@example.com", name: "Seller", tenant: "default" };
    // The middleware never touches the response object.
    authorize("admin")({ user: seller }, {} as Response, (err?: unknown) => {
      status = (err as { status?: number } | undefined)?.status;
    });
    expect(status).toBe(403);
  });
});

describe("payments and webhooks", () => {
  it("enforces the payment state machine", () => {
    expect(() => assertPaymentTransition("unpaid", "paid")).not.toThrow();
    expect(() => assertPaymentTransition("refunded", "paid")).toThrow(/Invalid payment transition/);
  });

  it("verifies webhook signatures and rejects stale timestamps", () => {
    const payload = JSON.stringify({ orderId: "507f1f77bcf86cd799439011", type: "payment.succeeded" });
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const signature = signPayload(payload, timestamp);
    expect(() => verifyWebhookSignature(payload, signature, timestamp)).not.toThrow();
    expect(() => verifyWebhookSignature(payload, signature, "1")).toThrow(/Stale webhook/);
  });
});

describe("SSRF and upload guards", () => {
  it("rejects non-HTTPS and private URLs", () => {
    expect(() => assertSafeExternalUrl("http://127.0.0.1/admin")).toThrow(/Only HTTPS|Private network/);
    expect(() => assertSafeExternalUrl("https://localhost/admin")).toThrow(/Private network/);
    expect(() => assertSafeExternalUrl("https://example.com/tracking")).not.toThrow();
  });

  it("rejects executables disguised as images", async () => {
    const tmpFile = path.join(os.tmpdir(), `unsafe-upload-${Date.now()}.jpg`);
    fs.writeFileSync(tmpFile, Buffer.from("MZ fake executable"));
    await expect(assertSafeImage({ path: tmpFile })).rejects.toThrow(/Invalid or unsafe image upload/);
  });
});

describe("service tokens and signed URLs", () => {
  it("issues scoped service tokens", () => {
    const token = createServiceToken("order", ["events:read"]);
    const payload = JwtService.verify(token, SERVICE_JWT_SECRET) as { type: string; scopes: string[] };
    expect(payload.type).toBe("service");
    expect(payload.scopes).toEqual(["events:read"]);
  });

  it("round-trips a signed URL", () => {
    const signedUrl = createSignedUrl({ path: "/uploads/private.jpg", tenant: "default", subject: "user-1", ttlSeconds: 60 });
    const parsed = new URL(`https://example.com${signedUrl}`);
    expect(
      verifySignedUrl({
        path: "/uploads/private.jpg",
        tenant: parsed.searchParams.get("tenant"),
        subject: parsed.searchParams.get("subject"),
        expires: parsed.searchParams.get("expires"),
        signature: parsed.searchParams.get("signature"),
      })
    ).toBe(true);
  });
});

describe("architecture helpers", () => {
  it("maps routes to service boundaries", () => {
    expect(serviceBoundaryForRoute("/orders/checkout")).toBe("order");
    expect(serviceBoundaryForRoute("/payments/webhook")).toBe("payment");
  });

  it("runs work inside a distributed lock", async () => {
    let entered = false;
    await withDistributedLock("test-lock", 1000, async () => {
      entered = true;
    });
    expect(entered).toBe(true);
  });
});
