import type { NextFunction, Request, Response } from "express";
import { loginSchema, refreshSchema, validate } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import AuthService from "../../services/AuthService.js";
import { CustomeErrorHandler } from "../../services/index.js";
import { assertAuthed } from "../../types/http.js";

class LoginController {
  authService: AuthService;

  constructor(authService = new AuthService()) {
    this.authService = authService;
    this.login = this.login.bind(this);
    this.logout = this.logout.bind(this);
  }

  async login(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(loginSchema, req.body);

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

  async logout(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(refreshSchema, req.body);

    if (error) {
      return next(error);
    }

    try {
      assertAuthed(req);
      await this.authService.logout(value.refresh_token, req.user._id, req.sessionId);
    } catch {
      return next(CustomeErrorHandler.serverError("Something went wrong in the database"));
    }
    return successResponse(res, null, "Successfully logged out");
  }
}

export default new LoginController();
