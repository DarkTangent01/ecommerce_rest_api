import multer from "multer";
import path from "path";
import { CustomeErrorHandler } from "../../services/index.js";
import fs from "fs";
import { productSchema } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import auditLogger from "../../utils/auditLogger.js";
import { UPLOAD_MAX_BYTES } from "../../config/index.js";
import crypto from "crypto";
import ProductService from "../../services/ProductService.js";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, "uploads/"),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const handleMultiPartData = multer({
  storage,
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1 },
  fileFilter(req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(ext)) {
      return cb(new Error("Only jpg, png and webp images are allowed"));
    }
    return cb(null, true);
  },
}).single("image");

const removeFile = (filePath) => {
  if (!filePath) return;
  fs.unlink(path.isAbsolute(filePath) ? filePath : path.join(global.appRoot || process.cwd(), filePath), (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Failed to remove uploaded file", err);
    }
  });
};

export const assertSafeImage = async (file) => {
  const buffer = await fs.promises.readFile(file.path);
  const head = buffer.subarray(0, 16);
  const asciiHead = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").toLowerCase();
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = head.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  const executableMarkers = ["mz", "<script", "<html", "<?php", "#!/"];
  const hasExecutableMarker = executableMarkers.some((marker) => asciiHead.includes(marker));
  const hasZipMarker = buffer.includes(Buffer.from("PK\u0003\u0004"));

  if (!(isJpeg || isPng || isWebp) || hasExecutableMarker || hasZipMarker) {
    removeFile(file.path);
    throw CustomeErrorHandler.badRequest("Invalid or unsafe image upload");
  }
};

class ProductController {
  constructor(productService = new ProductService()) {
    this.productService = productService;
    this.store = this.store.bind(this);
    this.update = this.update.bind(this);
    this.destroy = this.destroy.bind(this);
    this.index = this.index.bind(this);
    this.show = this.show.bind(this);
  }

  async store(req, res, next) {
    // Multipart form data
    handleMultiPartData(req, res, async (err) => {
      if (err) {
        return next(CustomeErrorHandler.badRequest(err.message));
      }
      if (!req.file) {
        return next(CustomeErrorHandler.badRequest("Product image is required"));
      }
      try {
        await assertSafeImage(req.file);
      } catch (uploadErr) {
        return next(uploadErr);
      }
      const filePath = req.file.path;

      //   Validation
      const { error, value } = productSchema.validate(req.body);
      if (error) {
        removeFile(filePath);
        return next(error);
      }
      try {
        const document = await this.productService.create({
          value,
          filePath,
          user: req.user,
          tenant: req.tenant,
        });
        auditLogger("product.create", req, { product: document._id });
        return successResponse(res, document, "Product created", 201);
      } catch (error) {
        removeFile(filePath);
        return next(error);
      }
    });
  }

  // Updating the products
  update(req, res, next) {
    handleMultiPartData(req, res, async (err) => {
      if (err) {
        return next(CustomeErrorHandler.badRequest(err.message));
      }
      let filePath;
      if (req.file) {
        filePath = req.file.path;
        try {
          await assertSafeImage(req.file);
        } catch (uploadErr) {
          return next(uploadErr);
        }
      }
      //   Validation
      const { error, value } = productSchema.validate(req.body);
      if (error) {
        removeFile(filePath);
        return next(error);
      }
      try {
        const document = await this.productService.update({
          id: req.params.id,
          value,
          filePath,
          user: req.user,
          tenant: req.tenant,
        });
        auditLogger("product.update", req, { product: document._id });
        return successResponse(res, document, "Product updated");
      } catch (err) {
        removeFile(filePath);
        return next(err);
      }
    });
  }

  async destroy(req, res, next) {
    try {
      const document = await this.productService.delete({ id: req.params.id, tenant: req.tenant });
      auditLogger("product.delete", req, { product: document._id });
      return successResponse(res, document, "Product deleted");
    } catch (err) {
      return next(err);
    }
  }

  async index(req, res, next) {
    try {
      const { data, meta } = await this.productService.list({ query: req.query, tenant: req.tenant });
      return successResponse(res, data, "Products fetched", 200, meta);
    } catch (err) {
      return next(CustomeErrorHandler.serverError());
    }
  }

  async show(req, res, next) {
    try {
      const document = await this.productService.show({ id: req.params.id, tenant: req.tenant });
      return successResponse(res, document, "Product fetched");
    } catch (err) {
      return next(err);
    }
  }
}

export default new ProductController();
