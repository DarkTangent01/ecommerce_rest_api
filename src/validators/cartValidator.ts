import { z } from "zod";
import { integer, objectIdString } from "./common.js";

export const cartItemSchema = z.object({
  productId: objectIdString(),
  quantity: integer().pipe(z.number().min(1).max(999)),
});

export type CartItemBody = z.infer<typeof cartItemSchema>;
