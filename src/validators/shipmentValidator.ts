import { z } from "zod";
import { requiredString } from "./common.js";

const isHttpsUrl = (value: string) => {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
};

export const shipmentSchema = z.object({
  carrier: requiredString(80),
  trackingNumber: requiredString(120),
  trackingUrl: z
    .string()
    .trim()
    .max(500)
    .refine((value) => value === "" || isHttpsUrl(value), "must be a valid https URL")
    .optional(),
  status: z.enum(["pending", "label_created", "in_transit", "delivered", "failed"]).default("label_created"),
});

export type ShipmentBody = z.infer<typeof shipmentSchema>;
