import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Product } from "../../src/models/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { api, createUser } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

const PNG = Buffer.from("89504e470d0a1a0a0000000d4948445200000001000000010806000000", "hex");
const uploadsDir = path.join(process.cwd(), "uploads");
const listUploads = () => new Set(fs.existsSync(uploadsDir) ? fs.readdirSync(uploadsDir) : []);
const newFiles = (before: Set<string>) => [...listUploads()].filter((name) => !before.has(name));

describe("product upload limits (DEP-01)", () => {
  it("rejects a form with too many fields and keeps no file", async () => {
    const { auth } = await createUser({ role: "admin" });
    const before = listUploads();
    let req = api().post("/api/products").set(auth).attach("image", PNG, { filename: "a.png", contentType: "image/png" });
    for (let i = 0; i < 30; i++) req = req.field(`extra${i}`, "x");
    const res = await req;
    expect(res.status).toBe(400);
    expect(await Product.countDocuments()).toBe(0);
    expect(newFiles(before)).toEqual([]);
  });

  it("rejects an oversized field value", async () => {
    const { auth } = await createUser({ role: "admin" });
    const res = await api()
      .post("/api/products")
      .set(auth)
      .field("name", "Big")
      .field("description", "x".repeat(70 * 1024))
      .attach("image", PNG, { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(400);
  });

  it("rejects non-image types before storing them", async () => {
    const { auth } = await createUser({ role: "admin" });
    const before = listUploads();
    const res = await api()
      .post("/api/products")
      .set(auth)
      .field("name", "Svg")
      .field("price", "1")
      .attach("image", Buffer.from("<svg onload=alert(1)>"), { filename: "x.svg", contentType: "image/svg+xml" });
    expect(res.status).toBe(400);
    expect(newFiles(before)).toEqual([]);
  });

  it("does not run the multipart parser for unauthenticated callers", async () => {
    const before = listUploads();
    const res = await api().post("/api/products").attach("image", PNG, { filename: "a.png", contentType: "image/png" });
    expect(res.status).toBe(401);
    expect(newFiles(before)).toEqual([]);
  });
});
