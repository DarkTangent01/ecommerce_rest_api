import { CustomeErrorHandler } from "./index.js";
import ProductRepository from "../repositories/ProductRepository.js";
import { cache } from "../utils/cache.js";
import { buildCursorPagination, buildPagination, buildSort, nextCursorFrom } from "../utils/pagination.js";
import { pickAllowedFields } from "../utils/fieldPolicy.js";

class ProductService {
  constructor(repository = new ProductRepository()) {
    this.repository = repository;
  }

  async create({ value, filePath, user, tenant }) {
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

  async update({ id, value, filePath, user, tenant }) {
    const allowedValue = pickAllowedFields("product", user.role, value);
    const filter = { _id: id, tenant, deletedAt: null };
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

  async delete({ id, tenant }) {
    const document = await this.repository.softDelete({ _id: id, tenant });
    if (!document) {
      throw CustomeErrorHandler.notFound("Product not found");
    }
    await cache.del("products:");
    return document;
  }

  async list({ query, tenant }) {
    const cacheKey = `products:${tenant}:${JSON.stringify(query)}`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;

    const useCursor = Boolean(query.cursor);
    const { page, limit, skip } = buildPagination(query);
    const cursorPagination = buildCursorPagination(query);
    const sort = buildSort(query.sortBy, query.order, ["name", "price", "createdAt", "stock"], "-createdAt");
    const filter = { isActive: true, tenant, deletedAt: null, ...cursorPagination.cursorFilter };

    if (query.category) {
      filter.category = query.category;
    }
    if (query.minPrice || query.maxPrice) {
      const minPrice = Number(query.minPrice);
      const maxPrice = Number(query.maxPrice);
      filter.price = {};
      if (Number.isFinite(minPrice)) filter.price.$gte = minPrice;
      if (Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
      if (Object.keys(filter.price).length === 0) delete filter.price;
    }
    if (query.q) {
      filter.$text = { $search: String(query.q).slice(0, 100) };
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

  async show({ id, tenant }) {
    const document = await this.repository.findByIdForTenant(id, tenant);
    if (!document) {
      throw CustomeErrorHandler.notFound("Product not found");
    }
    return document;
  }
}

export default ProductService;
