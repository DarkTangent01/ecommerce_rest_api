import type { Types } from "mongoose";
import { Cart, Product } from "../models/index.js";

type Id = Types.ObjectId | string;

class CartRepository {
  populateCart<Q extends { populate(options: { path: string; select: string }): Q }>(query: Q): Q {
    return query.populate({
      path: "items.product",
      select: "name price image stock isActive",
    });
  }

  findForUser(userId: Id, tenant: string) {
    return this.populateCart(Cart.findOne({ user: userId, tenant }));
  }

  findRawForUser(userId: Id, tenant: string) {
    return Cart.findOne({ user: userId, tenant });
  }

  findProduct(productId: Id, tenant: string) {
    return Product.findOne({ _id: productId, tenant, isActive: true, deletedAt: null });
  }

  updateExistingItem(userId: Id, tenant: string, productId: Id, quantity: number) {
    return Cart.findOneAndUpdate(
      { user: userId, tenant, "items.product": productId },
      { $set: { "items.$.quantity": quantity } },
      { new: true }
    );
  }

  /**
   * Adds `quantity` of a product to the cart atomically: increments an existing line, otherwise
   * pushes a new one guarded by `$ne` so concurrent adds can never create duplicate lines. A
   * concurrent first insert of the cart surfaces as a duplicate-key error and is retried.
   */
  async addQuantity(userId: Id, tenant: string, productId: Id, quantity: number) {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const incremented = await Cart.findOneAndUpdate(
        { user: userId, tenant, "items.product": productId },
        { $inc: { "items.$.quantity": quantity } },
        { new: true }
      );
      if (incremented) return incremented;

      try {
        const pushed = await Cart.findOneAndUpdate(
          { user: userId, tenant, "items.product": { $ne: productId } },
          { $push: { items: { product: productId, quantity } } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        );
        if (pushed) return pushed;
      } catch (err) {
        if ((err as { code?: number }).code !== 11000) throw err;
      }
    }
    throw new Error("Could not add the item to the cart after concurrent updates");
  }

  removeItem(userId: Id, tenant: string, productId: Id) {
    return this.populateCart(Cart.findOneAndUpdate({ user: userId, tenant }, { $pull: { items: { product: productId } } }, { new: true }));
  }

  clear(userId: Id, tenant: string) {
    return Cart.findOneAndUpdate({ user: userId, tenant }, { $set: { items: [] } }, { upsert: true, new: true });
  }

  findById(cartId: Id) {
    return this.populateCart(Cart.findById(cartId));
  }
}

export default CartRepository;
