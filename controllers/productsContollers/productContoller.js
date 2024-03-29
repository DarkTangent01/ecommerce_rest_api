import { Product } from "../../models";
import multer from "multer";
import path from "path";
import { CustomeErrorHandler } from "../../services";
import fs from "fs";
import { productSchema } from "../../validators";

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

  // Updating the products
  update(req, res, next) {
    handleMultiPartData(req, res, async (err) => {
      if (err) {
        return next(CustomeErrorHandler.serverError(err.message));
      }
      let filePath;
      if (req.file) {
        filePath = req.file.path;
      }
      //   Validation
      const { error } = productSchema.validate(req.body);
      if (error) {
        //   Delete the upload file
        if (req.file) {
          fs.unlink(`${appRoot}/${filePath}`, (err) => {
            if (err) {
              return next(CustomeErrorHandler.serverError(err.message));
            }
          });
        }
        return next(error);
      }

      const { name, price, size } = req.body;

      let document;

      try {
        document = await Product.findOneAndUpdate(
          { _id: req.params.id },
          {
            name: name,
            price: price,
            size: size,
            ...(req.file && { image: filePath }),
          },
          { new: true }
        );
      } catch (error) {
        return next(err);
      }
      res.status(201).json(document);
    });
  },

  async destroy(req, res, next) {
    const document = await Product.findOneAndRemove({ _id: req.params.id });
    if (!document) {
      return next(new Error("Nothing to delete"));
    }

    // image delete
    const imagePath = document._doc.image;
    fs.unlink(`${appRoot}/${imagePath}`, (err) => {
      if (err) {
        return next(new CustomeErrorHandler.serverError());
      }
    });

    res.json(document);
  },

  async index(req, res, next) {
    let documents;
    // pagination ---- mongoose-pagination
    try {
      documents = await Product.find().select("-updatedAt -__v");
    } catch (err) {
      return next(CustomeErrorHandler.serverError());
    }
    return res.json(documents);
  },

  async show(req, res, next) {
    let document;

    try {
      document = await Product.findOne({ _id: req.params.id }).select(
        "-updatedAt -__v"
      );
    } catch (err) {
      return next(CustomeErrorHandler.serverError());
    }
    return res.json(document);
  },
};

export default productController;
