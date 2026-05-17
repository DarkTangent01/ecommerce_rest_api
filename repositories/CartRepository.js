import { Cart, Product } from "../models/index.js";

class CartRepository {
  populateCart(query) {
    return query.populate({
      path: "items.product",
      select: "name price image stock isActive",
    });
  }

  findForUser(userId, tenant) {
    return this.populateCart(Cart.findOne({ user: userId, tenant }));
  }

  findRawForUser(userId, tenant) {
    return Cart.findOne({ user: userId, tenant });
  }

  findProduct(productId, tenant) {
    return Product.findOne({ _id: productId, tenant, isActive: true, deletedAt: null });
  }

  updateExistingItem(userId, tenant, productId, quantity) {
    return Cart.findOneAndUpdate(
      { user: userId, tenant, "items.product": productId },
      { $set: { "items.$.quantity": quantity } },
      { new: true }
    );
  }

  pushItem(userId, tenant, productId, quantity) {
    return Cart.findOneAndUpdate(
      { user: userId, tenant },
      { $push: { items: { product: productId, quantity } } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  }

  removeItem(userId, tenant, productId) {
    return Cart.findOneAndUpdate(
      { user: userId, tenant },
      { $pull: { items: { product: productId } } },
      { new: true }
    );
  }

  clear(userId, tenant) {
    return Cart.findOneAndUpdate({ user: userId, tenant }, { $set: { items: [] } }, { upsert: true, new: true });
  }

  findById(cartId) {
    return this.populateCart(Cart.findById(cartId));
  }
}

export default CartRepository;
