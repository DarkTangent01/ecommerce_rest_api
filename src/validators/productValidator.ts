import { z } from "zod";
import { boolish, integer, jsonish, money } from "./common.js";

const stock = () => integer().pipe(z.number().min(0).max(1000000)).default(0);

const variantSchema = z.object({
  size: z.string().trim().max(30).toUpperCase().optional(),
  color: z.string().trim().max(40).optional(),
  sku: z.string().trim().min(1, "is required").max(80).toUpperCase(),
  price: money(),
  stock: stock(),
});

const productSchema = z.object({
  name: z.string().trim().min(2).max(160),
  description: z.string().trim().max(3000).default(""),
  price: money(),
  size: z.string().trim().max(30).toUpperCase().optional(),
  category: z.string().trim().max(80).optional(),
  sku: z.string().trim().max(80).toUpperCase().optional(),
  stock: stock(),
  isActive: boolish().optional(),
  variants: jsonish(z.array(variantSchema).max(100)).optional(),
});

export type ProductBody = z.infer<typeof productSchema>;

export default productSchema;
