import { z } from "zod";
import { boolish, dateish, integer, numeric } from "./common.js";

export const couponSchema = z.object({
  code: z.string().trim().min(1, "is required").max(40).toUpperCase(),
  type: z.enum(["percentage", "fixed"]),
  value: numeric().pipe(z.number().min(0)),
  maxDiscount: numeric().pipe(z.number().min(0)).optional(),
  minOrderTotal: numeric().pipe(z.number().min(0)).default(0),
  usageLimit: integer().pipe(z.number().min(1)).default(1),
  perUserLimit: integer().pipe(z.number().min(1)).default(1),
  startsAt: dateish().optional(),
  expiresAt: dateish().optional(),
  isActive: boolish().default(true),
});

export type CouponInput = z.infer<typeof couponSchema>;
