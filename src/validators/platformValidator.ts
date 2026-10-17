import { z } from "zod";
import { dateish, requiredString } from "./common.js";

export const tenantSchema = z.object({
  // Optional for compatibility; when present it must name the caller's own tenant.
  key: z.string().trim().toLowerCase().max(80).optional(),
  name: requiredString(120),
  status: z.enum(["active", "suspended"]).optional(),
  config: z
    .object({
      currency: z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "must be an ISO 4217 code").optional(),
      locale: z.string().trim().max(20).optional(),
      paymentProvider: z.string().trim().max(80).optional(),
    })
    .optional(),
});

export const apiKeySchema = z.object({
  name: requiredString(80),
  scopes: z
    .array(z.string().trim().regex(/^[a-z]+:[a-z]+$/, "must look like resource:action"))
    .max(20)
    .default([]),
  expiresAt: dateish()
    .refine((date) => date.getTime() > Date.now(), "must be in the future")
    .optional(),
});

export type TenantBody = z.infer<typeof tenantSchema>;
export type ApiKeyBody = z.infer<typeof apiKeySchema>;
