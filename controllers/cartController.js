import { cartItemSchema } from "../validators/index.js";
import { successResponse } from "../utils/apiResponse.js";
import CartService from "../services/CartService.js";

class CartController {
  constructor(cartService = new CartService()) {
    this.cartService = cartService;
    this.show = this.show.bind(this);
    this.addItem = this.addItem.bind(this);
    this.updateItem = this.updateItem.bind(this);
    this.removeItem = this.removeItem.bind(this);
    this.clear = this.clear.bind(this);
  }

  async show(req, res, next) {
    try {
      const cart = await this.cartService.show(req.user._id, req.tenant);
      return successResponse(res, cart, "Cart fetched");
    } catch (err) {
      return next(err);
    }
  }

  async addItem(req, res, next) {
    const { error, value } = cartItemSchema.validate(req.body);
    if (error) return next(error);

    try {
      const cart = await this.cartService.addItem({
        userId: req.user._id,
        tenant: req.tenant,
        productId: value.productId,
        quantity: value.quantity,
      });
      return successResponse(res, cart, "Cart updated");
    } catch (err) {
      return next(err);
    }
  }

  async updateItem(req, res, next) {
    const { error, value } = cartItemSchema.validate(req.body);
    if (error) return next(error);

    try {
      const cart = await this.cartService.updateItem({
        userId: req.user._id,
        tenant: req.tenant,
        productId: value.productId,
        quantity: value.quantity,
      });
      return successResponse(res, cart, "Cart item updated");
    } catch (err) {
      return next(err);
    }
  }

  async removeItem(req, res, next) {
    try {
      const cart = await this.cartService.removeItem({
        userId: req.user._id,
        tenant: req.tenant,
        productId: req.params.productId,
      });
      return successResponse(res, cart, "Cart item removed");
    } catch (err) {
      return next(err);
    }
  }

  async clear(req, res, next) {
    try {
      const cart = await this.cartService.clear(req.user._id, req.tenant);
      return successResponse(res, cart, "Cart cleared");
    } catch (err) {
      return next(err);
    }
  }
}

export default new CartController();
