import type { NextFunction, Request, Response } from "express";
import { CustomeErrorHandler } from "../services/index.js";
import type { Role } from "../types/domain.js";

const authorize =
  (...roles: Role[]) =>
  (req: Pick<Request, "user">, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(CustomeErrorHandler.unAuthorized());
    }

    if (!roles.includes(req.user.role)) {
      return next(CustomeErrorHandler.forbidden("Insufficient permissions"));
    }

    return next();
  };

export default authorize;
