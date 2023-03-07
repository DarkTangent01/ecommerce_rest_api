import Joi from "joi";
import { REFRESH_SECRET } from "../../config";
import { RefreshToken, User } from "../../models";
import { CustomeErrorHandler, JwtService } from "../../services";

const refreshController = {
  async refresh(req, res, next) {
    // Input validation
    const refreshSchema = Joi.object({
      refresh_token: Joi.string().required(),
    });
    const { error } = refreshSchema.validate(req.body);
    if (error) {
      return next(error);
    }

    // Check in the database
    let refreshToken;
    try {
      refreshToken = await RefreshToken.findOne({
        token: req.body.refresh_token,
      });
      if (!refreshToken) {
        return next(CustomeErrorHandler.unAuthorized("Invalid refresh token"));
      }
      const { _id } = await JwtService.verify(refreshToken.token, REFRESH_SECRET);
      const user = await User.findOne({ _id });
      if (!user) {
        return next(CustomeErrorHandler.unAuthorized("No user found!"));
      }

      // Token
      const access_token = JwtService.sign({ _id: user._id, role: user.role });
      const newRefreshToken = JwtService.sign(
        { _id: user._id, role: user.role },
        "1y",
        REFRESH_SECRET
      );
      await RefreshToken.create({ token: newRefreshToken });

      res.json({ access_token, refresh_token: newRefreshToken });
    } catch (err) {
      return next(new Error("Something went wrong: " + err.message));
    }
  },
};

export default refreshController;