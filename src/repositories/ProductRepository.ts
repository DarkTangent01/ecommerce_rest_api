import type { FilterQuery, Types, UpdateQuery } from "mongoose";
import { Product } from "../models/index.js";
import type { Product as ProductShape } from "../types/domain.js";

class ProductRepository {
  create(data: Partial<ProductShape>) {
    return Product.create(data);
  }

  updateOne(filter: FilterQuery<ProductShape>, update: UpdateQuery<ProductShape>) {
    return Product.findOneAndUpdate(filter, update, { new: true, runValidators: true });
  }

  softDelete(filter: FilterQuery<ProductShape>) {
    return Product.findOneAndUpdate(filter, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  findByIdForTenant(id: Types.ObjectId | string, tenant: string) {
    return Product.findOne({ _id: id, tenant, deletedAt: null }).select("-updatedAt -__v");
  }

  findList(filter: FilterQuery<ProductShape>, sort: string, skip: number, limit: number) {
    return Product.find(filter).select("-updatedAt -__v").sort(sort).skip(skip).limit(limit).lean({ getters: true });
  }

  count(filter: FilterQuery<ProductShape>) {
    return Product.countDocuments(filter);
  }
}

export default ProductRepository;
