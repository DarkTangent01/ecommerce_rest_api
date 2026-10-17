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

  pushItem(userId: Id, tenant: string, productId: Id, quantity: number) {
    return Cart.findOneAndUpdate(
      { user: userId, tenant },
      { $push: { items: { product: productId, quantity } } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  removeItem(userId: Id, tenant: string, productId: Id) {
    return Cart.findOneAndUpdate({ user: userId, tenant }, { $pull: { items: { product: productId } } }, { new: true });
  }

  clear(userId: Id, tenant: string) {
    return Cart.findOneAndUpdate({ user: userId, tenant }, { $set: { items: [] } }, { upsert: true, new: true });
  }

  findById(cartId: Id) {
    return this.populateCart(Cart.findById(cartId));
  }
}

export default CartRepository;
