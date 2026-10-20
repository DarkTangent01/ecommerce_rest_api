import type { NextFunction, Request, Response } from "express";
import { CustomeErrorHandler, JwtService } from "../services/index.js";
import mongoose from "mongoose";
import { User, UserSession } from "../models/index.js";
import type { AccessTokenClaims } from "../services/AuthService.js";

const auth = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(CustomeErrorHandler.unAuthorized());
  }

  const token = authHeader.split(" ")[1] ?? "";

  try {
    const { _id, typ, sid } = JwtService.verify<AccessTokenClaims>(token);
    if (typ && typ !== "access") {
      return next(CustomeErrorHandler.unAuthorized());
    }
    if (sid !== undefined && (typeof sid !== "string" || !mongoose.Types.ObjectId.isValid(sid))) {
      return next(CustomeErrorHandler.unAuthorized());
    }
    // A token bound to a session dies with it: logout revokes the session, so its access token stops
    // working at once instead of at expiry (I-6). Runs alongside the user lookup, not after it.
    const [user, revoked] = await Promise.all([
      User.findOne({ _id, isActive: true, deletedAt: null }).select("_id role email name tenant"),
      sid ? UserSession.exists({ _id: sid, user: _id, revokedAt: { $exists: true } }) : null,
    ]);

    if (!user) {
      return next(CustomeErrorHandler.unAuthorized("Account is inactive or does not exist"));
    }
    if (revoked) {
      return next(CustomeErrorHandler.unAuthorized("Session has been signed out"));
    }

    req.user = {
      _id: user._id,
      // Always the stored role: a demoted user must lose privileges immediately, not when the token expires.
      role: user.role,
      email: user.email,
      name: user.name,
      tenant: user.tenant,
    };
    req.sessionId = typeof sid === "string" ? sid : undefined;
    req.tenant = user.tenant || req.tenant;
    next();
  } catch {
    return next(CustomeErrorHandler.unAuthorized());
  }
};

export default auth;
