import { CustomeErrorHandler } from "../services/index.js";

const admin = async (req, res, next) => {
  if (req.user?.role === "admin") {
    return next();
  }

  return next(CustomeErrorHandler.forbidden("Admin role required"));
};

export default admin;
