import type { NextFunction, Request, Response } from "express";
import { CustomeErrorHandler } from "../services/index.js";

const stepUpAuth = (req: Request, _res: Response, next: NextFunction) => {
  if (req.sessionContext?.stepUpRequired && !req.get("X-Step-Up-Verified")) {
    return next(CustomeErrorHandler.forbidden("Step-up authentication required"));
  }
  return next();
};

export default stepUpAuth;
