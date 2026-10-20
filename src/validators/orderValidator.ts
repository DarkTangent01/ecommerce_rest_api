import { z } from "zod";
import { requiredString } from "./common.js";

export const addressSchema = z.object({
  line1: requiredString(160),
  line2: z.string().trim().max(160).optional(),
  city: requiredString(80),
  state: requiredString(80),
  postalCode: requiredString(20),
  country: requiredString(80),
});

export const checkoutSchema = z.object({
  shippingAddress: addressSchema,
  paymentProvider: z.string().trim().max(80).default("manual"),
  paymentReference: z.string().trim().max(160).optional(),
  couponCode: z.string().trim().max(40).toUpperCase().optional(),
});

export const cancelOrderSchema = z.object({
  reason: requiredString(300),
});

export const refundOrderSchema = z.object({
  reason: requiredString(300),
});

export type AddressInput = z.infer<typeof addressSchema>;
export type CheckoutBody = z.infer<typeof checkoutSchema>;
export type ReasonBody = z.infer<typeof cancelOrderSchema>;
