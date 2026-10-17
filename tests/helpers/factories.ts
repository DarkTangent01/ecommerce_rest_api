import bcrypt from "bcrypt";
import { Types } from "mongoose";
import request from "supertest";
import { app } from "../../src/server.js";
import { Product, User } from "../../src/models/index.js";
import { JwtService } from "../../src/services/index.js";
import type { Role } from "../../src/types/domain.js";

export const TENANT = "acme";

let counter = 0;
const unique = () => `${Date.now().toString(36)}${(counter++).toString(36)}`;

export const createUser = async ({ role = "user", tenant = TENANT, password = "Password123" }: { role?: Role; tenant?: string; password?: string } = {}) => {
  const user = await User.create({
    name: `${role} ${unique()}`,
    email: `${role}-${unique()}@example.com`,
    password: await bcrypt.hash(password, 4),
    role,
    tenant,
  });
  const token = JwtService.sign({ _id: user._id, role: user.role });
  return { user, token, auth: { Authorization: `Bearer ${token}`, "X-Tenant-Id": tenant } };
};

export const createProduct = async ({
  price = 10,
  stock = 10,
  tenant = TENANT,
  seller,
}: { price?: number; stock?: number; tenant?: string; seller?: Types.ObjectId } = {}) =>
  Product.create({
    name: `Product ${unique()}`,
    price,
    stock,
    tenant,
    seller: seller ?? new Types.ObjectId(),
    image: "uploads/test.jpg",
  });

export const address = { line1: "221B Baker Street", city: "London", state: "London", postalCode: "NW1", country: "UK" };

export const idempotencyKey = () => `idem-${unique()}-0123456789`;

export const api = () => request(app);

export const addToCart = (auth: Record<string, string>, productId: Types.ObjectId, quantity = 1) =>
  api().post("/api/cart/items").set(auth).send({ productId: String(productId), quantity });

export const checkout = (auth: Record<string, string>, body: Record<string, unknown> = {}) =>
  api()
    .post("/api/orders/checkout")
    .set(auth)
    .set("Idempotency-Key", idempotencyKey())
    .send({ shippingAddress: address, ...body });
