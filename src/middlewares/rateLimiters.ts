import rateLimit from "express-rate-limit";
import { CustomeErrorHandler } from "../services/index.js";
import { redisClient } from "../infra/redis/redisClient.js";

const createLimiter = (windowMs: number, max: number, message: string) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    handler(_req, _res, next) {
      return next(CustomeErrorHandler.toManyRequest(message));
    },
  });

export const generalLimiter = createLimiter(15 * 60 * 1000, 300, "Too many requests, try again later.");
export const authLimiter = createLimiter(15 * 60 * 1000, 10, "Too many authentication attempts, try again later.");
/**
 * Failed logins per account, whatever the client IP: an IP-keyed limit alone can be spread over
 * many addresses. Successful logins do not count, so a guessing attacker cannot lock the owner out
 * for longer than the window.
 */
export const loginAccountLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => {
    const email = (req.body as { email?: unknown } | undefined)?.email;
    return `login:${typeof email === "string" ? email.trim().toLowerCase() : ""}`;
  },
  handler(_req, _res, next) {
    return next(CustomeErrorHandler.toManyRequest("Too many failed sign-in attempts for this account, try again later."));
  },
});
export const checkoutLimiter = createLimiter(15 * 60 * 1000, 20, "Too many checkout attempts, try again later.");
export const sensitiveLimiter = createLimiter(15 * 60 * 1000, 30, "Too many sensitive requests, try again later.");
export const reviewLimiter = createLimiter(60 * 60 * 1000, 10, "Too many review attempts, try again later.");
export const couponLimiter = createLimiter(60 * 60 * 1000, 20, "Too many coupon attempts, try again later.");

export const rateLimitBackend = redisClient.mode;
