import { describe, it } from "vitest";

// Bridge for the original assert-based smoke scripts while they are ported to Vitest.
// Each script throws on the first failed assertion, so a clean import means it passed.
describe("legacy smoke scripts", () => {
  it("security smoke tests", async () => {
    await import("./security.test.js");
  });

  it("service (OOP) tests", async () => {
    await import("./oop.test.js");
  });

  it("runtime route tests", async () => {
    await import("./runtime.test.js");
  });
});
