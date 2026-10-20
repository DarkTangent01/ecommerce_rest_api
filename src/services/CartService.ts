import type { Types } from "mongoose";
import { CustomeErrorHandler } from "./index.js";
import CartRepository from "../repositories/CartRepository.js";

type Id = Types.ObjectId | string;

export interface CartItemInput {
  userId: Id;
  tenant: string;
  productId: Id;
  quantity: number;
}

class CartService {
  repository: CartRepository;

  constructor(repository = new CartRepository()) {
    this.repository = repository;
  }

  emptyCart(userId: Id) {
    return { user: userId, items: [] };
  }

  async show(userId: Id, tenant: string) {
    return (await this.repository.findForUser(userId, tenant)) || this.emptyCart(userId);
  }

  async addItem({ userId, tenant, productId, quantity }: CartItemInput) {
    const product = await this.repository.findProduct(productId, tenant);
    if (!product) throw CustomeErrorHandler.notFound("Product not found");

    // Advisory check for a fast, friendly error; checkout re-checks stock atomically.
    const currentCart = await this.repository.findRawForUser(userId, tenant);
    const existingItem = currentCart?.items.find((item) => String(item.product) === String(product._id));
    const requestedQuantity = (existingItem?.quantity || 0) + quantity;
    if (product.stock < requestedQuantity) throw CustomeErrorHandler.badRequest("Insufficient stock");
    if (requestedQuantity > 999) throw CustomeErrorHandler.badRequest("Quantity per item cannot exceed 999");

    const cart = await this.repository.addQuantity(userId, tenant, product._id, quantity);
    return this.repository.findById(cart._id);
  }

  async updateItem({ userId, tenant, productId, quantity }: CartItemInput) {
    const product = await this.repository.findProduct(productId, tenant);
    if (!product) throw CustomeErrorHandler.notFound("Product not found");
    if (product.stock < quantity) throw CustomeErrorHandler.badRequest("Insufficient stock");

    const cart = await this.repository.updateExistingItem(userId, tenant, product._id, quantity);
    if (!cart) throw CustomeErrorHandler.notFound("Cart item not found");
    return this.repository.findById(cart._id);
  }

  async removeItem({ userId, tenant, productId }: Omit<CartItemInput, "quantity">) {
    return (await this.repository.removeItem(userId, tenant, productId)) || this.emptyCart(userId);
  }

  async clear(userId: Id, tenant: string) {
    await this.repository.clear(userId, tenant);
    return { items: [] };
  }
}

export default CartService;
