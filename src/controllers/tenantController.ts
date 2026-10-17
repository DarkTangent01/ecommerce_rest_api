import type { NextFunction, Request, Response } from "express";
import { Tenant } from "../models/index.js";
import { successResponse } from "../utils/apiResponse.js";

class TenantController {
  constructor() {
    this.current = this.current.bind(this);
    this.upsert = this.upsert.bind(this);
  }

  async current(req: Request, res: Response, next: NextFunction) {
    try {
      const tenant = await Tenant.findOne({ key: req.tenant });
      return successResponse(res, tenant || { key: req.tenant, status: "implicit" }, "Tenant fetched");
    } catch (err) {
      return next(err);
    }
  }

  async upsert(req: Request, res: Response, next: NextFunction) {
    try {
      // TODO: unvalidated mass assignment across tenants (audit H8); typed loosely until that fix.
      const body = (req.body ?? {}) as Record<string, unknown> & { key?: string };
      const tenant = await Tenant.findOneAndUpdate(
        { key: String(body.key || req.tenant).toLowerCase() },
        { ...body, key: String(body.key || req.tenant).toLowerCase() },
        { upsert: true, new: true, runValidators: true }
      );
      return successResponse(res, tenant, "Tenant saved");
    } catch (err) {
      return next(err);
    }
  }
}

export default new TenantController();
