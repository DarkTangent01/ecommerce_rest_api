import type { NextFunction, Request, Response } from "express";
import multer from "multer";
import path from "path";
import { CustomeErrorHandler } from "../../services/index.js";
import fs from "fs";
import { productSchema, validate } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import auditLogger from "../../utils/auditLogger.js";
import { UPLOAD_MAX_BYTES } from "../../config/index.js";
import crypto from "crypto";
import ProductService from "../../services/ProductService.js";
import { assertAuthed } from "../../types/http.js";

const allowedMimeTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const allowedExtensions = new Set([".jpg", ".jpeg", ".png", ".webp"]);

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, "uploads/"),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = `${crypto.randomUUID()}${ext}`;
    cb(null, uniqueName);
  },
});

const handleMultiPartData = multer({
  storage,
  // Bounds every part of the multipart body, not just the file (DEP-01 hardening): a product form
  // has ~10 text fields, a 3000-char description and at most 100 JSON-encoded variants.
  limits: { fileSize: UPLOAD_MAX_BYTES, files: 1, fields: 20, fieldSize: 64 * 1024, fieldNameSize: 100, parts: 25 },
  fileFilter(_req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    if (!allowedMimeTypes.has(file.mimetype) || !allowedExtensions.has(ext)) {
      return cb(new Error("Only jpg, png and webp images are allowed"));
    }
    return cb(null, true);
  },
}).single("image");

const removeFile = (filePath: string | undefined) => {
  if (!filePath) return;
  fs.unlink(path.isAbsolute(filePath) ? filePath : path.join(global.appRoot || process.cwd(), filePath), (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("Failed to remove uploaded file", err);
    }
  });
};

export const assertSafeImage = async (file: Pick<Express.Multer.File, "path">) => {
  const buffer = await fs.promises.readFile(file.path);
  const head = buffer.subarray(0, 16);
  const asciiHead = buffer.subarray(0, Math.min(buffer.length, 512)).toString("utf8").toLowerCase();
  const isJpeg = head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
  const isPng = head.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isWebp = head.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP";
  // A PE executable ("MZ") cannot also start with an image signature, so it is already rejected by
  // the magic-byte check; searching for "mz" anywhere rejected genuine images containing those bytes.
  const executableMarkers = ["<script", "<html", "<?php", "#!/"];
  const hasExecutableMarker = executableMarkers.some((marker) => asciiHead.includes(marker));
  const hasZipMarker = buffer.includes(Buffer.from("PK\u0003\u0004"));

  if (!(isJpeg || isPng || isWebp) || hasExecutableMarker || hasZipMarker) {
    removeFile(file.path);
    throw CustomeErrorHandler.badRequest("Invalid or unsafe image upload");
  }
};

class ProductController {
  productService: ProductService;

  constructor(productService = new ProductService()) {
    this.productService = productService;
    this.store = this.store.bind(this);
    this.update = this.update.bind(this);
    this.destroy = this.destroy.bind(this);
    this.index = this.index.bind(this);
    this.show = this.show.bind(this);
  }

  store(req: Request, res: Response, next: NextFunction) {
    // Multipart form data
    handleMultiPartData(req, res, async (err: unknown) => {
      if (err) {
        return next(CustomeErrorHandler.badRequest((err as Error).message));
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
      const { error, value } = validate(productSchema, req.body);
      if (error) {
        removeFile(filePath);
        return next(error);
      }
      try {
        assertAuthed(req);
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
  update(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    handleMultiPartData(req, res, async (err: unknown) => {
      if (err) {
        return next(CustomeErrorHandler.badRequest((err as Error).message));
      }
      let filePath: string | undefined;
      if (req.file) {
        filePath = req.file.path;
        try {
          await assertSafeImage(req.file);
        } catch (uploadErr) {
          return next(uploadErr);
        }
      }
      //   Validation
      const { error, value } = validate(productSchema, req.body);
      if (error) {
        removeFile(filePath);
        return next(error);
      }
      try {
        assertAuthed(req);
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

  async destroy(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try {
      const document = await this.productService.delete({ id: req.params.id, tenant: req.tenant });
      auditLogger("product.delete", req, { product: document._id });
      return successResponse(res, document, "Product deleted");
    } catch (err) {
      return next(err);
    }
  }

  async index(req: Request, res: Response, next: NextFunction) {
    try {
      const { data, meta } = await this.productService.list({ query: req.query, tenant: req.tenant });
      return successResponse(res, data, "Products fetched", 200, meta);
    } catch (err) {
      // Let the central handler pick the status (e.g. 400 for a bad cursor) and log the cause.
      return next(err);
    }
  }

  async show(req: Request<{ id: string }>, res: Response, next: NextFunction) {
    try {
      const document = await this.productService.show({ id: req.params.id, tenant: req.tenant });
      return successResponse(res, document, "Product fetched");
    } catch (err) {
      return next(err);
    }
  }
}

export default new ProductController();
