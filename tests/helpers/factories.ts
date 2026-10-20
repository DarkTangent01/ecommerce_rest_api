import bcrypt from "bcrypt";
import { Types } from "mongoose";
import request from "supertest";
import { app } from "../../src/server.js";
import { Product, User, UserSession } from "../../src/models/index.js";
import { JwtService } from "../../src/services/index.js";
import type { Role } from "../../src/types/domain.js";
import {
  authLimiter,
  checkoutLimiter,
  couponLimiter,
  generalLimiter,
  reviewLimiter,
  sensitiveLimiter,
} from "../../src/middlewares/rateLimiters.js";

export const TENANT = "acme";

const limiters = [generalLimiter, authLimiter, checkoutLimiter, sensitiveLimiter, reviewLimiter, couponLimiter];

/** The production limiters stay on in tests; this clears their in-memory counters for the loopback client. */
export const resetRateLimits = () => {
  for (const limiter of limiters) {
    for (const ip of ["127.0.0.1", "::ffff:127.0.0.1", "::1"]) limiter.resetKey(ip);
  }
};

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
  // A real session, as login creates, so step-up protected routes see a normal-risk session.
  const session = await UserSession.create({ user: user._id, deviceId: `test-${unique()}` });
  const token = JwtService.sign({ _id: user._id, role: user.role, typ: "access", sid: String(session._id) });
  return { user, token, session, auth: { Authorization: `Bearer ${token}`, "X-Tenant-Id": tenant } };
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
