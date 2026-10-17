import { Product } from "../models/index.js";

class ProductRepository {
  create(data) {
    return Product.create(data);
  }

  updateOne(filter, update) {
    return Product.findOneAndUpdate(filter, update, { new: true, runValidators: true });
  }

  softDelete(filter) {
    return Product.findOneAndUpdate(filter, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
  }

  findByIdForTenant(id, tenant) {
    return Product.findOne({ _id: id, tenant, deletedAt: null }).select("-updatedAt -__v");
  }

  findList(filter, sort, skip, limit) {
    return Product.find(filter).select("-updatedAt -__v").sort(sort).skip(skip).limit(limit).lean({ getters: true });
  }

  count(filter) {
    return Product.countDocuments(filter);
  }
}

export default ProductRepository;
