import { z } from "zod";
import { integer } from "./common.js";

export const reviewSchema = z.object({
  rating: integer().pipe(z.number().min(1).max(5)),
  title: z.string().trim().max(120).optional(),
  comment: z.string().trim().max(2000).optional(),
});

export type ReviewBody = z.infer<typeof reviewSchema>;
