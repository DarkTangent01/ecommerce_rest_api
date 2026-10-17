import { CustomeErrorHandler } from "./index.js";
import CartRepository from "../repositories/CartRepository.js";

class CartService {
  constructor(repository = new CartRepository()) {
    this.repository = repository;
  }

  emptyCart(userId) {
    return { user: userId, items: [] };
  }

  async show(userId, tenant) {
    return (await this.repository.findForUser(userId, tenant)) || this.emptyCart(userId);
  }

  async addItem({ userId, tenant, productId, quantity }) {
    const product = await this.repository.findProduct(productId, tenant);
    if (!product) throw CustomeErrorHandler.notFound("Product not found");

    const currentCart = await this.repository.findRawForUser(userId, tenant);
    const existingItem = currentCart?.items.find((item) => String(item.product) === String(product._id));
    const requestedQuantity = (existingItem?.quantity || 0) + quantity;
    if (product.stock < requestedQuantity) throw CustomeErrorHandler.badRequest("Insufficient stock");

    const cart = existingItem
      ? await this.repository.updateExistingItem(userId, tenant, product._id, requestedQuantity)
      : await this.repository.pushItem(userId, tenant, product._id, quantity);

    return this.repository.findById(cart._id);
  }

  async updateItem({ userId, tenant, productId, quantity }) {
    const product = await this.repository.findProduct(productId, tenant);
    if (!product) throw CustomeErrorHandler.notFound("Product not found");
    if (product.stock < quantity) throw CustomeErrorHandler.badRequest("Insufficient stock");

    const cart = await this.repository.updateExistingItem(userId, tenant, product._id, quantity);
    if (!cart) throw CustomeErrorHandler.notFound("Cart item not found");
    return this.repository.findById(cart._id);
  }

  async removeItem({ userId, tenant, productId }) {
    return (await this.repository.removeItem(userId, tenant, productId)) || this.emptyCart(userId);
  }

  async clear(userId, tenant) {
    await this.repository.clear(userId, tenant);
    return { items: [] };
  }
}

export default CartService;
