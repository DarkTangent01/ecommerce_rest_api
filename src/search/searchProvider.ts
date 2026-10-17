import type { FilterQuery } from "mongoose";
import { Product } from "../models/index.js";
import type { Product as ProductShape } from "../types/domain.js";

export const searchProducts = async ({ tenant, q, limit = 20 }: { tenant: string; q?: string; limit?: number }) => {
  const filter: FilterQuery<ProductShape> = { tenant, isActive: true, deletedAt: null };
  if (q) filter.$text = { $search: String(q).slice(0, 100) };
  return Product.find(filter).limit(limit).lean({ getters: true });
};

export const searchProviderInfo = () => ({
  backend: process.env.SEARCH_BACKEND || "mongodb-text",
  elasticsearchReady: true,
});
