import { Tenant } from "../models/index.js";
import { successResponse } from "../utils/apiResponse.js";

class TenantController {
  constructor() {
    this.current = this.current.bind(this);
    this.upsert = this.upsert.bind(this);
  }

  async current(req, res, next) {
    try {
      const tenant = await Tenant.findOne({ key: req.tenant });
      return successResponse(res, tenant || { key: req.tenant, status: "implicit" }, "Tenant fetched");
    } catch (err) {
      return next(err);
    }
  }

  async upsert(req, res, next) {
    try {
      const tenant = await Tenant.findOneAndUpdate(
        { key: String(req.body.key || req.tenant).toLowerCase() },
        { ...req.body, key: String(req.body.key || req.tenant).toLowerCase() },
        { upsert: true, new: true, runValidators: true }
      );
      return successResponse(res, tenant, "Tenant saved");
    } catch (err) {
      return next(err);
    }
  }
}

export default new TenantController();
