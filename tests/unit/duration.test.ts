import { describe, expect, it } from "vitest";
import { parseDurationMs } from "../../src/utils/duration.js";

describe("parseDurationMs", () => {
  it("honours the unit (refresh expiry used to read '12h' as 12 days)", () => {
    expect(parseDurationMs("12h")).toBe(12 * 3_600_000);
    expect(parseDurationMs("7d")).toBe(7 * 86_400_000);
    expect(parseDurationMs("15m")).toBe(900_000);
    expect(parseDurationMs("2w")).toBe(14 * 86_400_000);
  });

  it("rejects unit-less values", () => {
    expect(() => parseDurationMs("7")).toThrow(/Invalid duration/);
  });
});
