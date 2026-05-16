import { RefreshToken, User } from "../../models/index.js";
import { CustomeErrorHandler, JwtService } from "../../services/index.js";
import bcrypt from "bcrypt";
import { ACCESS_TOKEN_TTL, REFRESH_SECRET, REFRESH_TOKEN_TTL } from "../../config/index.js";
import { loginSchema, refreshSchema } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import { recordSecuritySignal, trackSession } from "../../services/securityService.js";

const refreshExpiry = () => {
  const days = Number.parseInt(REFRESH_TOKEN_TTL, 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const loginController = {
  async login(req, res, next) {
    const { error, value } = loginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    try {
      const user = await User.findOne({ email: value.email, isActive: true }).select("+password role email name");
      if (!user) {
        await recordSecuritySignal({ type: "auth.login_failed", severity: "medium", tenant: req.tenant, ip: req.ip, metadata: { email: value.email } });
        return next(CustomeErrorHandler.wrongCredentials());
      }

      // compare the password
      const match = await bcrypt.compare(value.password, user.password);

      if (!match) {
        await recordSecuritySignal({ type: "auth.login_failed", severity: "medium", user: user._id, tenant: req.tenant, ip: req.ip });
        return next(CustomeErrorHandler.wrongCredentials());
      }

      // Token
      const access_token = JwtService.sign({
        _id: user._id,
        role: user.role,
      }, ACCESS_TOKEN_TTL);

      const refresh_token = JwtService.sign(
        { _id: user._id, role: user.role },
        REFRESH_TOKEN_TTL,
        REFRESH_SECRET
      );

      const savedRefreshToken = await RefreshToken.create({ token: refresh_token, user: user._id, expiresAt: refreshExpiry() });
      const session = await trackSession({ user, refreshToken: savedRefreshToken._id, req });
      await recordSecuritySignal({ type: "auth.login_succeeded", severity: session.stepUpRequired ? "medium" : "info", user: user._id, tenant: req.tenant, ip: req.ip, metadata: { stepUpRequired: session.stepUpRequired } });

      return successResponse(res, { access_token, refresh_token, step_up_required: session.stepUpRequired }, "Logged in successfully");
    } catch (err) {
      console.error(err);
      return next(CustomeErrorHandler.serverError("An error occurred while logging in"));
    }
  },

  async logout(req, res, next) {
    const { error, value } = refreshSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    try {
      await RefreshToken.deleteOne({ token: value.refresh_token, user: req.user._id });
    } catch (err) {
      return next(CustomeErrorHandler.serverError("Something went wrong in the database"));
    }
    return successResponse(res, null, "Successfully logged out");
  },
};

export default loginController;
