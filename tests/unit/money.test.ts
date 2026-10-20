import { describe, expect, it } from "vitest";
import { calculateDiscountCents } from "../../src/services/couponService.js";
import { fromCents, percentOf, roundMoney, toCents } from "../../src/utils/money.js";

describe("money helpers", () => {
  it("converts to cents without float drift", () => {
    expect(toCents(0.1) * 3).toBe(30);
    expect(toCents(1.005)).toBe(101);
    expect(toCents(19.99)).toBe(1999);
    expect(fromCents(toCents(0.1) * 3)).toBe(0.3);
  });

  it("rounds percentages to the nearest cent", () => {
    expect(percentOf(5997, 10)).toBe(600);
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
  });
});

describe("calculateDiscountCents", () => {
  it("caps a percentage discount at maxDiscount and the subtotal", () => {
    expect(calculateDiscountCents({ type: "percentage", value: 50, maxDiscount: 5 }, 2000)).toBe(500);
    expect(calculateDiscountCents({ type: "fixed", value: 30 }, 2000)).toBe(2000);
  });

  it("returns 0 without a coupon", () => {
    expect(calculateDiscountCents(null, 2000)).toBe(0);
  });
});
