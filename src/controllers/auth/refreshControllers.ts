import type { NextFunction, Request, Response } from "express";
import { CustomeErrorHandler } from "../../services/index.js";
import { refreshSchema, validate } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import AuthService from "../../services/AuthService.js";

class RefreshController {
  authService: AuthService;

  constructor(authService = new AuthService()) {
    this.authService = authService;
    this.refresh = this.refresh.bind(this);
  }

  async refresh(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(refreshSchema, req.body);
    if (error) {
      return next(error);
    }

    try {
      const tokens = await this.authService.refresh(value.refresh_token);
      return successResponse(res, tokens, "Token refreshed");
    } catch {
      return next(CustomeErrorHandler.unAuthorized("Invalid refresh token"));
    }
  }
}

export default new RefreshController();
