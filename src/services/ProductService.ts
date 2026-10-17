import type { FilterQuery, Types } from "mongoose";
import { CustomeErrorHandler } from "./index.js";
import ProductRepository from "../repositories/ProductRepository.js";
import { cache } from "../utils/cache.js";
import { buildCursorPagination, buildPagination, buildSort, nextCursorFrom, type QueryInput } from "../utils/pagination.js";
import { pickAllowedFields } from "../utils/fieldPolicy.js";
import type { AuthUser, Product } from "../types/domain.js";

export type ProductInput = Partial<Pick<Product, "name" | "description" | "price" | "size" | "category" | "sku" | "stock" | "isActive" | "variants">>;

type Actor = Pick<AuthUser, "_id" | "role">;

const LIST_QUERY_KEYS = ["page", "limit", "cursor", "sortBy", "order", "category", "minPrice", "maxPrice", "q"] as const;

class ProductService {
  repository: ProductRepository;

  constructor(repository = new ProductRepository()) {
    this.repository = repository;
  }

  async create({ value, filePath, user, tenant }: { value: ProductInput; filePath: string; user: Actor; tenant: string }) {
    const allowedValue = pickAllowedFields("product", user.role, value);
    const document = await this.repository.create({
      ...allowedValue,
      image: filePath,
      seller: user._id,
      tenant,
    });
    await cache.del("products:");
    return document;
  }

  async update({
    id,
    value,
    filePath,
    user,
    tenant,
  }: {
    id: Types.ObjectId | string;
    value: ProductInput;
    filePath?: string;
    user: Actor;
    tenant: string;
  }) {
    const allowedValue = pickAllowedFields("product", user.role, value);
    const filter: FilterQuery<Product> = { _id: id, tenant, deletedAt: null };
    if (user.role === "seller") {
      filter.seller = user._id;
    }

    const document = await this.repository.updateOne(filter, {
      ...allowedValue,
      ...(filePath && { image: filePath }),
    });
    if (!document) {
      throw CustomeErrorHandler.notFound("Product not found");
    }
    await cache.del("products:");
    return document;
  }

  async delete({ id, tenant }: { id: Types.ObjectId | string; tenant: string }) {
    const document = await this.repository.softDelete({ _id: id, tenant });
    if (!document) {
      throw CustomeErrorHandler.notFound("Product not found");
    }
    await cache.del("products:");
    return document;
  }

  async list({ query, tenant }: { query: QueryInput; tenant: string }) {
    // Only parameters that affect the result are part of the key, so junk parameters cannot
    // mint unlimited cache entries.
    const keyParams = Object.fromEntries(LIST_QUERY_KEYS.filter((key) => query[key] !== undefined).map((key) => [key, query[key]]));
    const cacheKey = `products:${tenant}:${JSON.stringify(keyParams)}`;
    const cached = await cache.get<{ data: unknown[]; meta: Record<string, unknown> }>(cacheKey);
    if (cached) return cached;

    const useCursor = Boolean(query.cursor);
    const { page, limit, skip } = buildPagination(query);
    const cursorPagination = buildCursorPagination(query);
    const sort = buildSort(query.sortBy, query.order, ["name", "price", "createdAt", "stock"], "-createdAt");
    const filter: FilterQuery<Product> = { isActive: true, tenant, deletedAt: null, ...cursorPagination.cursorFilter };

    // `category` is the one query key allowed to repeat (see preventParameterPollution); an array
    // used to become an exact-array match that never hit anything.
    const categories = ([] as unknown[]).concat(query.category ?? []).filter((c): c is string => typeof c === "string" && c !== "");
    if (categories.length === 1) filter.category = categories[0];
    if (categories.length > 1) filter.category = { $in: categories };
    if (query.minPrice || query.maxPrice) {
      const minPrice = Number(query.minPrice);
      const maxPrice = Number(query.maxPrice);
      const price: { $gte?: number; $lte?: number } = {};
      if (Number.isFinite(minPrice)) price.$gte = minPrice;
      if (Number.isFinite(maxPrice)) price.$lte = maxPrice;
      if (Object.keys(price).length > 0) filter.price = price;
    }
    // Nested query objects (?q[x]=y) are ignored rather than searched as "[object Object]".
    if (typeof query.q === "string" && query.q) {
      const q = query.q
        .slice(0, 100)
        .replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const search = new RegExp(q, "i");
      filter.$or = [{ name: search }, { description: search }, { category: search }, { sku: search }];
    }

    const [data, total] = await Promise.all([
      this.repository.findList(filter, useCursor ? "-createdAt" : sort, useCursor ? 0 : skip, useCursor ? cursorPagination.limit : limit),
      this.repository.count(filter),
    ]);

    const meta = {
      page,
      limit: useCursor ? cursorPagination.limit : limit,
      total,
      pages: Math.ceil(total / limit),
      nextCursor: useCursor ? nextCursorFrom(data) : null,
    };
    const result = { data, meta };
    await cache.set(cacheKey, result);
    return result;
  }

  async show({ id, tenant }: { id: Types.ObjectId | string; tenant: string }) {
    const document = await this.repository.findByIdForTenant(id, tenant);
    if (!document) {
      throw CustomeErrorHandler.notFound("Product not found");
    }
    return document;
  }
}

export default ProductService;
