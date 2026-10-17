import { CustomeErrorHandler } from "../services/index.js";

const stepUpAuth = (req, res, next) => {
  if (req.sessionContext?.stepUpRequired && !req.get("X-Step-Up-Verified")) {
    return next(CustomeErrorHandler.forbidden("Step-up authentication required"));
  }
  return next();
};

export default stepUpAuth;
