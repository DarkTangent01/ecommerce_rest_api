import Joi from "joi";

export const couponSchema = Joi.object({
  code: Joi.string().trim().max(40).uppercase().required(),
  type: Joi.string().valid("percentage", "fixed").required(),
  value: Joi.number().min(0).required(),
  maxDiscount: Joi.number().min(0),
  minOrderTotal: Joi.number().min(0).default(0),
  usageLimit: Joi.number().integer().min(1).default(1),
  perUserLimit: Joi.number().integer().min(1).default(1),
  startsAt: Joi.date(),
  expiresAt: Joi.date(),
  isActive: Joi.boolean().default(true),
}).options({ stripUnknown: true, abortEarly: false });
