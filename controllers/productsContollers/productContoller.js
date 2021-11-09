import { Product } from "../../models";
import multer from "multer";
import path from "path";
import { CustomeErrorHandler } from "../../services";
import Joi from "joi";
import fs from "fs";

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.round(
      Math.random() * 1e9
    )}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

const handleMultiPartData = multer({
  storage,
  limits: { fileSize: 1000000 * 5 },
}).single("image");

const productController = {
  async store(req, res, next) {
    // Multipart form data
    handleMultiPartData(req, res, async (err) => {
      if (err) {
        return next(CustomeErrorHandler.serverError(err.message));
      }
      const filePath = req.file.path;
      //   Validation
      const productSchema = Joi.object({
        name: Joi.string().required(),
        price: Joi.number().required(),
        size: Joi.string().uppercase(),
      });

      const { error } = productSchema.validate(req.body);
      if (error) {
        //   Delete the upload file

        fs.unlink(`${appRoot}/${filePath}`, (err) => {
          if (err) {
            return next(CustomeErrorHandler.serverError(err.message));
          }
        });
        return next(error);
      }

      const { name, price, size } = req.body;

      let document;

      try {
        document = await Product.create({
          name: name,
          price: price,
          size: size,
          image: filePath,
        });
      } catch (error) {
        return next(err);
      }
      res.status(201).json(document);
    });
  },
};

export default productController;
