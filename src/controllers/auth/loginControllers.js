import { loginSchema, refreshSchema } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import AuthService from "../../services/AuthService.js";
import { CustomeErrorHandler } from "../../services/index.js";

class LoginController {
  constructor(authService = new AuthService()) {
    this.authService = authService;
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
  }

  async login(req, res, next) {
    const { error, value } = loginSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    try {
      const result = await this.authService.login({
        ...value,
        tenant: req.tenant,
        ip: req.ip,
        req,
      });
      return successResponse(res, result, "Logged in successfully");
    } catch (err) {
      if (err instanceof CustomeErrorHandler) return next(err);
      return next(CustomeErrorHandler.serverError("An error occurred while logging in"));
    }
  }

  async logout(req, res, next) {
    const { error, value } = refreshSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    try {
      await this.authService.logout(value.refresh_token, req.user._id);
    } catch (err) {
      return next(CustomeErrorHandler.serverError("Something went wrong in the database"));
    }
    return successResponse(res, null, "Successfully logged out");
  }
}

export default new LoginController();
