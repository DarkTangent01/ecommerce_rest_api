import Joi from "joi";

//   Validation
const productSchema = Joi.object({
  name: Joi.string().required(),
  price: Joi.number().required(),
  size: Joi.string().uppercase(),
  image: Joi.string()
});

export default productSchema;
