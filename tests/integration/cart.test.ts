import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { Cart } from "../../src/models/index.js";
import { clearDb, startDb, stopDb } from "../helpers/db.js";
import { addToCart, api, createProduct, createUser } from "../helpers/factories.js";

beforeAll(() => startDb());
afterAll(() => stopDb());
beforeEach(() => clearDb());

describe("cart", () => {
  it("adds, updates and removes items", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ stock: 5 });

    expect((await addToCart(auth, product._id, 2)).body.data.items).toEqual([expect.objectContaining({ quantity: 2 })]);
    const updated = await api().put("/api/cart/items").set(auth).send({ productId: String(product._id), quantity: 4 });
    expect(updated.body.data.items[0].quantity).toBe(4);

    const removed = await api().delete(`/api/cart/items/${String(product._id)}`).set(auth);
    expect(removed.status).toBe(200);
    expect(removed.body.data.items).toEqual([]);
  });

  it("rejects quantities above stock", async () => {
    const { auth } = await createUser();
    const product = await createProduct({ stock: 1 });
    const res = await addToCart(auth, product._id, 2);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe("Insufficient stock");
  });

  it("merges concurrent adds of the same product into one line (audit M4)", async () => {
    const { auth, user } = await createUser();
    const product = await createProduct({ stock: 50 });

    const results = await Promise.all([1, 2, 3, 4, 5].map(() => addToCart(auth, product._id, 1)));
    expect(results.every((r) => r.status === 200)).toBe(true);

    const cart = await Cart.findOne({ user: user._id });
    expect(cart!.items).toHaveLength(1);
    expect(cart!.items[0]!.quantity).toBe(5);
  });

  it("returns a populated cart after removing an item, like every other cart call", async () => {
    const { auth } = await createUser();
    const [a, b] = [await createProduct(), await createProduct()];
    await addToCart(auth, a._id);
    await addToCart(auth, b._id);
    const res = await api().delete(`/api/cart/items/${String(a._id)}`).set(auth);
    expect(res.body.data.items[0].product).toMatchObject({ _id: String(b._id), name: b.name });
  });
});
