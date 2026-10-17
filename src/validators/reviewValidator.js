import Joi from "joi";

export const reviewSchema = Joi.object({
  rating: Joi.number().integer().min(1).max(5).required(),
  title: Joi.string().trim().max(120).allow(""),
  comment: Joi.string().trim().max(2000).allow(""),
}).options({ stripUnknown: true, abortEarly: false });
