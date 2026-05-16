import { Product } from "../models/index.js";

export const searchProducts = async ({ tenant, q, limit = 20 }) => {
  const filter = { tenant, isActive: true, deletedAt: null };
  if (q) filter.$text = { $search: String(q).slice(0, 100) };
  return Product.find(filter).limit(limit).lean({ getters: true });
};

export const searchProviderInfo = () => ({
  backend: process.env.SEARCH_BACKEND || "mongodb-text",
  elasticsearchReady: true,
});
