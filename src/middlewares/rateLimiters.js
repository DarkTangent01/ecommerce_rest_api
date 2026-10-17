import rateLimit from "express-rate-limit";
import { CustomeErrorHandler } from "../services/index.js";
import { redisClient } from "../infra/redis/redisClient.js";

const createLimiter = (windowMs, max, message) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler(req, res, next) {
      return next(CustomeErrorHandler.toManyRequest(message));
    },
  });

export const generalLimiter = createLimiter(15 * 60 * 1000, 300, "Too many requests, try again later.");
export const authLimiter = createLimiter(15 * 60 * 1000, 10, "Too many authentication attempts, try again later.");
export const checkoutLimiter = createLimiter(15 * 60 * 1000, 20, "Too many checkout attempts, try again later.");
export const sensitiveLimiter = createLimiter(15 * 60 * 1000, 30, "Too many sensitive requests, try again later.");
export const reviewLimiter = createLimiter(60 * 60 * 1000, 10, "Too many review attempts, try again later.");
export const couponLimiter = createLimiter(60 * 60 * 1000, 20, "Too many coupon attempts, try again later.");

export const rateLimitBackend = redisClient.mode;
