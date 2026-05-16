import { DEFAULT_TENANT } from "../config/index.js";

const tenantContext = (req, res, next) => {
  const tenant = String(req.get("X-Tenant-Id") || DEFAULT_TENANT).toLowerCase().trim();
  req.tenant = tenant || DEFAULT_TENANT;
  res.setHeader("X-Tenant-Id", req.tenant);
  next();
};

export default tenantContext;
