import { Product } from "../../models/index.js";
import multer from "multer";
import path from "path";
import { CustomeErrorHandler } from "../../services/index.js";
import fs from "fs";
import { productSchema } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import { buildCursorPagination, buildPagination, buildSort, nextCursorFrom } from "../../utils/pagination.js";
import auditLogger from "../../utils/auditLogger.js";
import { UPLOAD_MAX_BYTES } from "../../config/index.js";
import crypto from "crypto";
import { pickAllowedFields } from "../../utils/fieldPolicy.js";
import { cache } from "../../utils/cache.js";

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

const productController = {
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
      const allowedValue = pickAllowedFields("product", req.user.role, value);

      let document;

      try {
        document = await Product.create({
          ...allowedValue,
          image: filePath,
          seller: req.user._id,
          tenant: req.tenant,
        });
        await cache.del("products:");
      } catch (error) {
        removeFile(filePath);
        return next(error);
      }
      auditLogger("product.create", req, { product: document._id });
      return successResponse(res, document, "Product created", 201);
    });
  },

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
      const allowedValue = pickAllowedFields("product", req.user.role, value);

      let document;

      try {
        const filter = { _id: req.params.id, tenant: req.tenant, deletedAt: null };
        if (req.user.role === "seller") {
          filter.seller = req.user._id;
        }
        document = await Product.findOneAndUpdate(
          filter,
          {
            ...allowedValue,
            ...(req.file && { image: filePath }),
          },
          { new: true, runValidators: true }
        );
        if (!document) {
          removeFile(filePath);
          return next(CustomeErrorHandler.notFound("Product not found"));
        }
      } catch (err) {
        removeFile(filePath);
        return next(err);
      }
      await cache.del("products:");
      auditLogger("product.update", req, { product: document._id });
      return successResponse(res, document, "Product updated");
    });
  },

  async destroy(req, res, next) {
    const document = await Product.findOneAndUpdate({ _id: req.params.id, tenant: req.tenant }, { $set: { deletedAt: new Date(), isActive: false } }, { new: true });
    if (!document) {
      return next(CustomeErrorHandler.notFound("Product not found"));
    }

    await cache.del("products:");

    auditLogger("product.delete", req, { product: document._id });
    return successResponse(res, document, "Product deleted");
  },

  async index(req, res, next) {
    try {
      const cacheKey = `products:${JSON.stringify(req.query)}`;
      const cached = await cache.get(cacheKey);
      if (cached) return successResponse(res, cached.data, "Products fetched", 200, cached.meta);

      const useCursor = Boolean(req.query.cursor);
      const { page, limit, skip } = buildPagination(req.query);
      const cursorPagination = buildCursorPagination(req.query);
      const sort = buildSort(req.query.sortBy, req.query.order, ["name", "price", "createdAt", "stock"], "-createdAt");
      const filter = { isActive: true, tenant: req.tenant, deletedAt: null, ...cursorPagination.cursorFilter };

      if (req.query.category) {
        filter.category = req.query.category;
      }
      if (req.query.minPrice || req.query.maxPrice) {
        const minPrice = Number(req.query.minPrice);
        const maxPrice = Number(req.query.maxPrice);
        filter.price = {};
        if (Number.isFinite(minPrice)) filter.price.$gte = minPrice;
        if (Number.isFinite(maxPrice)) filter.price.$lte = maxPrice;
        if (Object.keys(filter.price).length === 0) delete filter.price;
      }
      if (req.query.q) {
        filter.$text = { $search: String(req.query.q).slice(0, 100) };
      }

      const [documents, total] = await Promise.all([
        Product.find(filter).select("-updatedAt -__v").sort(useCursor ? "-createdAt" : sort).skip(useCursor ? 0 : skip).limit(useCursor ? cursorPagination.limit : limit).lean({ getters: true }),
        Product.countDocuments(filter),
      ]);

      const meta = {
        page,
        limit: useCursor ? cursorPagination.limit : limit,
        total,
        pages: Math.ceil(total / limit),
        nextCursor: useCursor ? nextCursorFrom(documents) : null,
      };
      await cache.set(cacheKey, { data: documents, meta });
      return successResponse(res, documents, "Products fetched", 200, meta);
    } catch (err) {
      return next(CustomeErrorHandler.serverError());
    }
  },

  async show(req, res, next) {
    let document;

    try {
      document = await Product.findOne({ _id: req.params.id, tenant: req.tenant, deletedAt: null }).select(
        "-updatedAt -__v"
      );
      if (!document) {
        return next(CustomeErrorHandler.notFound("Product not found"));
      }
    } catch (err) {
      return next(CustomeErrorHandler.serverError());
    }
    return successResponse(res, document, "Product fetched");
  },
};

export default productController;
