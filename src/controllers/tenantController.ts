import type { NextFunction, Request, Response } from "express";
import { Tenant } from "../models/index.js";
import { CustomeErrorHandler } from "../services/index.js";
import { successResponse } from "../utils/apiResponse.js";
import { tenantSchema, validate } from "../validators/index.js";

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
    const { error, value } = validate(tenantSchema, req.body);
    if (error) return next(error);

    // An admin manages only the tenant they authenticated into; `key` in the body used to let
    // them create or overwrite any other tenant.
    if (value.key && value.key !== req.tenant) {
      return next(CustomeErrorHandler.forbidden("Cannot modify another tenant"));
    }

    try {
      const { key: _ignored, config, ...fields } = value;
      const configUpdate = Object.fromEntries(Object.entries(config ?? {}).map(([field, v]) => [`config.${field}`, v]));
      const tenant = await Tenant.findOneAndUpdate(
        { key: req.tenant },
        { $set: { ...fields, ...configUpdate, key: req.tenant } },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
      );
      return successResponse(res, tenant, "Tenant saved");
    } catch (err) {
      return next(err);
    }
  }
}

export default new TenantController();
