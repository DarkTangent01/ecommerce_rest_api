import Joi from "joi";

export const checkoutSchema = Joi.object({
  shippingAddress: Joi.object({
    line1: Joi.string().trim().max(160).required(),
    line2: Joi.string().trim().max(160).allow(""),
    city: Joi.string().trim().max(80).required(),
    state: Joi.string().trim().max(80).required(),
    postalCode: Joi.string().trim().max(20).required(),
    country: Joi.string().trim().max(80).required(),
  }).required(),
  paymentProvider: Joi.string().trim().max(80).default("manual"),
  paymentReference: Joi.string().trim().max(160).allow(""),
  couponCode: Joi.string().trim().max(40).uppercase().allow(""),
}).options({ stripUnknown: true, abortEarly: false });

export const cancelOrderSchema = Joi.object({
  reason: Joi.string().trim().max(300).required(),
}).options({ stripUnknown: true });

export const refundOrderSchema = Joi.object({
  reason: Joi.string().trim().max(300).required(),
}).options({ stripUnknown: true });
