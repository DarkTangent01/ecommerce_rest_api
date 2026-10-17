import Joi from "joi";

export const cartItemSchema = Joi.object({
  productId: Joi.string().hex().length(24).required(),
  quantity: Joi.number().integer().min(1).max(999).required(),
}).options({ stripUnknown: true });
