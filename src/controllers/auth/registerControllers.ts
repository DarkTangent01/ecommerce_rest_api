import type { NextFunction, Request, Response } from "express";
import { registerSchema, validate } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import AuthService from "../../services/AuthService.js";

class RegisterController {
  authService: AuthService;

  constructor(authService = new AuthService()) {
    this.authService = authService;
    this.register = this.register.bind(this);
  }

  async register(req: Request, res: Response, next: NextFunction) {
    const { error, value } = validate(registerSchema, req.body);

    if (error) {
      return next(error);
    }

    try {
      const tokens = await this.authService.register({
        name: value.name,
        email: value.email,
        password: value.password,
        tenant: req.tenant,
        req,
      });
      return successResponse(res, tokens, "Registered successfully", 201);
    } catch (err) {
      return next(err);
    }
  }
}

export default new RegisterController();
