import type { NextFunction, Request, Response } from "express";
import { CustomeErrorHandler } from "../services/index.js";

const admin = (req: Request, _res: Response, next: NextFunction) => {
  if (req.user?.role === "admin") {
    return next();
  }

  return next(CustomeErrorHandler.forbidden("Admin role required"));
};

export default admin;
