import { CustomeErrorHandler } from "../../services/index.js";
import { refreshSchema } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import AuthService from "../../services/AuthService.js";

class RefreshController {
  constructor(authService = new AuthService()) {
    this.authService = authService;
    this.refresh = this.refresh.bind(this);
  }

  async refresh(req, res, next) {
    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    try {
      const tokens = await this.authService.refresh(value.refresh_token);
      return successResponse(res, tokens, "Token refreshed");
    } catch (err) {
      return next(CustomeErrorHandler.unAuthorized("Invalid refresh token"));
    }
  }
}

export default new RefreshController();
