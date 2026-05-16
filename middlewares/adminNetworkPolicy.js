import { ADMIN_IP_ALLOWLIST, ADMIN_IP_DENYLIST } from "../config/index.js";
import { CustomeErrorHandler } from "../services/index.js";

const parseList = (value) => value.split(",").map((item) => item.trim()).filter(Boolean);

const adminNetworkPolicy = (req, res, next) => {
  const ip = req.ip?.replace("::ffff:", "");
  const allow = parseList(ADMIN_IP_ALLOWLIST);
  const deny = parseList(ADMIN_IP_DENYLIST);

  if (deny.includes(ip)) return next(CustomeErrorHandler.forbidden("Admin IP denied"));
  if (allow.length > 0 && !allow.includes(ip)) return next(CustomeErrorHandler.forbidden("Admin IP not allowed"));
  return next();
};

export default adminNetworkPolicy;
