import type { NextFunction, Request, Response } from "express";
import mongoose from "mongoose";
import { CustomeErrorHandler } from "../services/index.js";
import { UserSession } from "../models/index.js";

/**
 * Blocks sensitive actions from sessions flagged as risky at login (see trackSession).
 *
 * The session is the one named by the access token's `sid` claim. It used to be looked up by the
 * client-supplied X-Device-Id, so sending any other device id found no session and skipped the
 * check (SEC-02). This now fails closed: a token without a session, or whose session is gone or
 * revoked, is treated as needing step-up. There is no step-up challenge (e.g. MFA) to complete
 * yet, so a risky session must sign in again once the risk window passes.
 */
const stepUpAuth = async (req: Request, _res: Response, next: NextFunction) => {
  if (!req.user) return next(CustomeErrorHandler.unAuthorized());

  try {
    const session =
      req.sessionId && mongoose.Types.ObjectId.isValid(req.sessionId)
        ? await UserSession.findOne({ _id: req.sessionId, user: req.user._id, revokedAt: { $exists: false } }).select("stepUpRequired")
        : null;
    req.sessionContext = { stepUpRequired: !session || session.stepUpRequired };

    if (req.sessionContext.stepUpRequired) {
      return next(CustomeErrorHandler.forbidden("Step-up authentication required"));
    }
    return next();
  } catch (err) {
    return next(err);
  }
};

export default stepUpAuth;
