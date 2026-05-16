import { ACCESS_TOKEN_TTL, REFRESH_SECRET, REFRESH_TOKEN_TTL } from "../../config/index.js";
import { RefreshToken, User } from "../../models/index.js";
import { CustomeErrorHandler, JwtService } from "../../services/index.js";
import { refreshSchema } from "../../validators/index.js";
import { successResponse } from "../../utils/apiResponse.js";

const refreshExpiry = () => {
  const days = Number.parseInt(REFRESH_TOKEN_TTL, 10) || 7;
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
};

const refreshController = {
  async refresh(req, res, next) {
    const { error, value } = refreshSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    // Check in the database
    let refreshToken;
    try {
      refreshToken = await RefreshToken.findOne({
        token: value.refresh_token,
        revokedAt: null,
      });
      if (!refreshToken) {
        return next(CustomeErrorHandler.unAuthorized("Invalid refresh token"));
      }
      const { _id } = await JwtService.verify(refreshToken.token, REFRESH_SECRET);
      const user = await User.findOne({ _id, isActive: true });
      if (!user) {
        return next(CustomeErrorHandler.unAuthorized("No user found!"));
      }

      // Token
      const access_token = JwtService.sign({ _id: user._id, role: user.role }, ACCESS_TOKEN_TTL);
      const newRefreshToken = JwtService.sign(
        { _id: user._id, role: user.role },
        REFRESH_TOKEN_TTL,
        REFRESH_SECRET
      );
      refreshToken.revokedAt = new Date();
      await refreshToken.save();
      await RefreshToken.create({ token: newRefreshToken, user: user._id, expiresAt: refreshExpiry() });

      return successResponse(res, { access_token, refresh_token: newRefreshToken }, "Token refreshed");
    } catch (err) {
      return next(CustomeErrorHandler.unAuthorized("Invalid refresh token"));
    }
  },
};

export default refreshController;
