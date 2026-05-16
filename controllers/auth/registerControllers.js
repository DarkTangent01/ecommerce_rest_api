import { CustomeErrorHandler } from "../../services/index.js";
import { RefreshToken, User } from "../../models/index.js";
import bcrypt from "bcrypt";
import { JwtService } from "../../services/index.js";
import { ACCESS_TOKEN_TTL, BCRYPT_ROUNDS, REFRESH_SECRET, REFRESH_TOKEN_TTL } from "../../config/index.js";
import { registerSchema } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";
import { trackSession } from "../../services/securityService.js";

const refreshExpiry = () => {
  const days = Number.parseInt(REFRESH_TOKEN_TTL, 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const registerController = {
  async register(req, res, next) {
    const { error, value } = registerSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    // check if user is in the database already
    try {
      const exist = await User.exists({ email: value.email });
      if (exist) {
        return next(
          CustomeErrorHandler.alreadyExist("This email is already taken.")
        );
      }
    } catch (err) {
      return next(err);
    }

    const { name, email, password } = value;

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

    const user = new User({
      name: name,
      email: email,
      password: hashedPassword,
      tenant: req.tenant,
    });

    // save in the database

    let access_token;
    let refresh_token;
    try {
      const result = await user.save();

      // Token
      access_token = JwtService.sign({ _id: result._id, role: result.role }, ACCESS_TOKEN_TTL);

      refresh_token = JwtService.sign(
        { _id: result._id, role: result.role },
        REFRESH_TOKEN_TTL,
        REFRESH_SECRET
      );

      // refresh_token save in database and whitelist the refresh_token
      const savedRefreshToken = await RefreshToken.create({ token: refresh_token, user: result._id, expiresAt: refreshExpiry() });
      await trackSession({ user: result, refreshToken: savedRefreshToken._id, req });
    } catch (err) {
      return next(err);
    }

    return successResponse(res, { access_token, refresh_token }, "Registered successfully", 201);
  },
};

export default registerController;
