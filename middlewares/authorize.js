import { CustomeErrorHandler } from "../services/index.js";

const authorize = (...roles) => (req, res, next) => {
  if (!req.user) {
    return next(CustomeErrorHandler.unAuthorized());
  }

  if (!roles.includes(req.user.role)) {
    return next(CustomeErrorHandler.forbidden("Insufficient permissions"));
  }

  return next();
};

export default authorize;
