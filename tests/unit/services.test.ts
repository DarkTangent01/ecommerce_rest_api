import { describe, expect, it } from "vitest";

import AuthService from "../../src/services/AuthService.js";
import CartService from "../../src/services/CartService.js";
import PaymentService from "../../src/services/PaymentService.js";
import ProductService from "../../src/services/ProductService.js";

// Repositories are replaced with minimal fakes; only the methods each case touches exist.
// TODO: `as never` casts stand in for full repository implementations in these unit fakes.
const seller = { _id: "seller-1", role: "seller" } as never;

describe("ProductService", () => {
  it("keeps admin-only fields out of seller writes", async () => {
    const writes: Record<string, unknown>[] = [];
    const service = new ProductService({
      async create(data: Record<string, unknown>) {
        writes.push(data);
        return { _id: "product-1", ...data };
      },
    } as never);

    const created = (await service.create({
      value: { name: "Backpack", price: 1200, stock: 5, isActive: false },
      filePath: "uploads/product.jpg",
      user: seller,
      tenant: "tenant-a",
    })) as unknown as Record<string, unknown>;

    expect(created.seller).toBe("seller-1");
    expect(created.tenant).toBe("tenant-a");
    expect(created.image).toBe("uploads/product.jpg");
    expect(writes[0]).not.toHaveProperty("isActive");
  });

  it("throws when the product to update does not exist", async () => {
    const service = new ProductService({ async updateOne() { return null; } } as never);
    await expect(
      service.update({ id: "missing", value: { name: "Missing" }, user: seller, tenant: "tenant-a" })
    ).rejects.toThrow(/Product not found/);
  });
});

describe("CartService", () => {
  it("rejects quantities above available stock", async () => {
    const service = new CartService({
      async findProduct() {
        return { _id: "product-1", stock: 3 };
      },
      async findRawForUser() {
        return { items: [{ product: "product-1", quantity: 2 }] };
      },
    } as never);

    await expect(
      service.addItem({ userId: "user-1", tenant: "tenant-a", productId: "product-1", quantity: 2 })
    ).rejects.toThrow(/Insufficient stock/);
  });
});

describe("PaymentService", () => {
  it("treats a known event id as a replay", async () => {
    const service = new PaymentService({ async findEvent() { return { _id: "event-1" }; } } as never);
    service.verifyWebhook = () => undefined;

    const result = await service.processWebhook({
      headers: { provider: "manual", eventId: "evt-1" },
      body: { orderId: "order-1", type: "payment.succeeded" },
      rawPayload: "{}",
      req: {},
    });

    expect(result).toEqual({ replay: true });
    expect(service.targetStateForEvent("payment.refunded")).toBe("refunded");
    expect(service.hashPayload("{}")).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe("AuthService", () => {
  it("rejects unknown refresh tokens", async () => {
    const service = new AuthService({ async findActiveRefreshToken() { return null; } } as never);
    await expect(service.refresh("bad-token")).rejects.toThrow(/Invalid refresh token/);
  });
});
