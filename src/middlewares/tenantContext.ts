import type { NextFunction, Request, Response } from "express";
import { DEFAULT_TENANT } from "../config/index.js";

const tenantContext = (req: Request, res: Response, next: NextFunction) => {
  const tenant = String(req.get("X-Tenant-Id") || DEFAULT_TENANT)
    .toLowerCase()
    .trim();
  req.tenant = tenant || DEFAULT_TENANT;
  res.setHeader("X-Tenant-Id", req.tenant);
  next();
};

export default tenantContext;
