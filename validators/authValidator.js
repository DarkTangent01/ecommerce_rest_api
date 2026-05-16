import Joi from "joi";

const password = Joi.string()
  .min(8)
  .max(72)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/)
  .required()
  .messages({
    "string.pattern.base": "Password must include uppercase, lowercase and a number",
  });

export const registerSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  email: Joi.string().trim().email().lowercase().max(254).required(),
  password,
  repeat_password: Joi.valid(Joi.ref("password")).required(),
}).options({ stripUnknown: true, abortEarly: false });

export const loginSchema = Joi.object({
  email: Joi.string().trim().email().lowercase().max(254).required(),
  password: Joi.string().max(72).required(),
}).options({ stripUnknown: true, abortEarly: false });

export const refreshSchema = Joi.object({
  refresh_token: Joi.string().trim().required(),
}).options({ stripUnknown: true });
