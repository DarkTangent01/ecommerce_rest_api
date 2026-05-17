import { registerSchema } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import AuthService from "../../services/AuthService.js";

class RegisterController {
  constructor(authService = new AuthService()) {
    this.authService = authService;
    this.register = this.register.bind(this);
  }

  async register(req, res, next) {
    const { error, value } = registerSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    try {
      const tokens = await this.authService.register({
        ...value,
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
