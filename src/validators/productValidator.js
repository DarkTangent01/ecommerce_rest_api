import Joi from "joi";

//   Validation
const productSchema = Joi.object({
  name: Joi.string().trim().min(2).max(160).required(),
  description: Joi.string().trim().max(3000).allow("").default(""),
  price: Joi.number().precision(2).min(0).required(),
  size: Joi.string().trim().max(30).uppercase().allow(""),
  category: Joi.string().trim().max(80).allow(""),
  sku: Joi.string().trim().max(80).uppercase().allow(""),
  stock: Joi.number().integer().min(0).max(1000000).default(0),
  isActive: Joi.boolean(),
  variants: Joi.array()
    .items(
      Joi.object({
        size: Joi.string().trim().max(30).uppercase().allow(""),
        color: Joi.string().trim().max(40).allow(""),
        sku: Joi.string().trim().max(80).uppercase().required(),
        price: Joi.number().precision(2).min(0).required(),
        stock: Joi.number().integer().min(0).max(1000000).default(0),
      })
    )
    .max(100),
}).options({ stripUnknown: true, abortEarly: false });

export default productSchema;
