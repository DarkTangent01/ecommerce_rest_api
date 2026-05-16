import { Product } from "../models/index.js";

export const getRecommendationsForUser = async ({ tenant, limit = 10 }) =>
  Product.find({ tenant, isActive: true, deletedAt: null }).sort("-ratingAverage -createdAt").limit(limit).lean({ getters: true });
