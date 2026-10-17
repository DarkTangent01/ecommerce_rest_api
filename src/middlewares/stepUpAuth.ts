import type { NextFunction, Request, Response } from "express";
import { CustomeErrorHandler } from "../services/index.js";
import { UserSession } from "../models/index.js";
import { deviceIdFor } from "../services/securityService.js";

/**
 * Blocks sensitive actions from sessions flagged as risky at login (see trackSession).
 *
 * Previously `req.sessionContext` was never populated, so this never fired, and a client could
 * bypass it anyway by sending any `X-Step-Up-Verified` value. The flag is now loaded from the
 * session for this user and device, and the header is ignored: there is no step-up challenge
 * (e.g. MFA) to verify yet, so a risky session must sign in again once the risk window passes.
 */
const stepUpAuth = async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(CustomeErrorHandler.unAuthorized());

  try {
    const session = await UserSession.findOne({ user: req.user._id, deviceId: deviceIdFor(req), revokedAt: { $exists: false } })
      .sort({ lastSeenAt: -1 })
      .select("stepUpRequired");
    req.sessionContext = { stepUpRequired: Boolean(session?.stepUpRequired) };

    if (req.sessionContext.stepUpRequired) {
      return next(CustomeErrorHandler.forbidden("Step-up authentication required"));
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

export default stepUpAuth;
