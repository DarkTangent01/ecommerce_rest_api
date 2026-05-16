import { SERVICE_JWT_SECRET } from "../config/index.js";
import { CustomeErrorHandler, JwtService } from "../services/index.js";

const serviceAuth = (...requiredScopes) => (req, res, next) => {
  const authHeader = req.get("Authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return next(CustomeErrorHandler.unAuthorized("Service token required"));

  try {
    const payload = JwtService.verify(authHeader.slice(7), SERVICE_JWT_SECRET);
    if (payload.type !== "service") return next(CustomeErrorHandler.unAuthorized("Invalid service token"));
    const scopes = payload.scopes || [];
    if (!requiredScopes.every((scope) => scopes.includes(scope))) {
      return next(CustomeErrorHandler.forbidden("Service scope denied"));
    }
    req.service = payload.service;
    return next();
  } catch (err) {
    return next(CustomeErrorHandler.unAuthorized("Invalid service token"));
  }
};

export default serviceAuth;
