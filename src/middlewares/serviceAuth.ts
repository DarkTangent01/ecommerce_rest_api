import type { NextFunction, Request, Response } from "express";
import { SERVICE_JWT_SECRET } from "../config/index.js";
import { CustomeErrorHandler, JwtService } from "../services/index.js";
import type { ServiceTokenClaims } from "../infra/serviceClient.js";

const serviceAuth =
  (...requiredScopes: string[]) =>
  (req: Request, _res: Response, next: NextFunction) => {
    const authHeader = req.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return next(CustomeErrorHandler.unAuthorized("Service token required"));

    try {
      const payload = JwtService.verify<Partial<ServiceTokenClaims>>(authHeader.slice(7), SERVICE_JWT_SECRET);
      if (payload.type !== "service") return next(CustomeErrorHandler.unAuthorized("Invalid service token"));
      const scopes = payload.scopes || [];
      if (!requiredScopes.every((scope) => scopes.includes(scope))) {
        return next(CustomeErrorHandler.forbidden("Service scope denied"));
      }
      // The tenant comes from the signed token, never from the caller's X-Tenant-Id (I-7).
      if (typeof payload.tenant !== "string" || !payload.tenant) {
        return next(CustomeErrorHandler.forbidden("Service token is not scoped to a tenant"));
      }
      req.service = payload.service;
      req.tenant = payload.tenant;
      return next();
    } catch {
      return next(CustomeErrorHandler.unAuthorized("Invalid service token"));
    }
  };

export default serviceAuth;
