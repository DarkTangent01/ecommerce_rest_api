import Joi from "joi";

export const shipmentSchema = Joi.object({
  carrier: Joi.string().trim().max(80).required(),
  trackingNumber: Joi.string().trim().max(120).required(),
  trackingUrl: Joi.string().trim().uri({ scheme: ["https"] }).max(500).allow(""),
  status: Joi.string().valid("pending", "label_created", "in_transit", "delivered", "failed").default("label_created"),
}).options({ stripUnknown: true, abortEarly: false });
