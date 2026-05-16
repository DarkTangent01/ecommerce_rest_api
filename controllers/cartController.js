import { Cart, Product } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { cartItemSchema } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";

const populateCart = (query) =>
  query.populate({
    path: "items.product",
    select: "name price image stock isActive",
  });

const cartController = {
  async show(req, res, next) {
    try {
      const cart = await populateCart(Cart.findOne({ user: req.user._id, tenant: req.tenant }));
      return successResponse(res, cart || { user: req.user._id, items: [] }, "Cart fetched");
    } catch (err) {
      return next(err);
    }
  },

  async addItem(req, res, next) {
    const { error, value } = cartItemSchema.validate(req.body);
    if (error) return next(error);

    try {
      const product = await Product.findOne({ _id: value.productId, tenant: req.tenant, isActive: true, deletedAt: null });
      if (!product) return next(CustomeErrorHandler.notFound("Product not found"));

      const currentCart = await Cart.findOne({ user: req.user._id, tenant: req.tenant });
      const existingItem = currentCart?.items.find((item) => String(item.product) === String(product._id));
      const requestedQuantity = (existingItem?.quantity || 0) + value.quantity;
      if (product.stock < requestedQuantity) return next(CustomeErrorHandler.badRequest("Insufficient stock"));

      const cart = existingItem
        ? await Cart.findOneAndUpdate(
            { user: req.user._id, tenant: req.tenant, "items.product": product._id },
            { $set: { "items.$.quantity": requestedQuantity } },
            { new: true }
          )
        : null;

      const result =
        cart ||
        (await Cart.findOneAndUpdate(
          { user: req.user._id, tenant: req.tenant },
          { $push: { items: { product: product._id, quantity: value.quantity } } },
          { new: true, upsert: true, setDefaultsOnInsert: true }
        ));

      return successResponse(res, await populateCart(Cart.findById(result._id)), "Cart updated");
    } catch (err) {
      return next(err);
    }
  },

  async updateItem(req, res, next) {
    const { error, value } = cartItemSchema.validate(req.body);
    if (error) return next(error);

    try {
      const product = await Product.findOne({ _id: value.productId, tenant: req.tenant, isActive: true, deletedAt: null });
      if (!product) return next(CustomeErrorHandler.notFound("Product not found"));
      if (product.stock < value.quantity) return next(CustomeErrorHandler.badRequest("Insufficient stock"));

      const cart = await Cart.findOneAndUpdate(
        { user: req.user._id, tenant: req.tenant, "items.product": product._id },
        { $set: { "items.$.quantity": value.quantity } },
        { new: true }
      );

      if (!cart) return next(CustomeErrorHandler.notFound("Cart item not found"));
      return successResponse(res, await populateCart(Cart.findById(cart._id)), "Cart item updated");
    } catch (err) {
      return next(err);
    }
  },

  async removeItem(req, res, next) {
    try {
      const cart = await Cart.findOneAndUpdate(
        { user: req.user._id, tenant: req.tenant },
        { $pull: { items: { product: req.params.productId } } },
        { new: true }
      );

      return successResponse(res, cart || { user: req.user._id, items: [] }, "Cart item removed");
    } catch (err) {
      return next(err);
    }
  },

  async clear(req, res, next) {
    try {
      await Cart.findOneAndUpdate({ user: req.user._id, tenant: req.tenant }, { $set: { items: [] } }, { upsert: true });
      return successResponse(res, { items: [] }, "Cart cleared");
    } catch (err) {
      return next(err);
    }
  },
};

export default cartController;
