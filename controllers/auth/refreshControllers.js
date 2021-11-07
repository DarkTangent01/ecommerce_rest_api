import Joi from "joi";
import { REFRESH_SECRET } from "../../config";
import { RefreshToken, User } from "../../models";
import { CustomeErrorHandler, JwtService } from "../../services";

const refreshController = {
  async refresh(req, res, next) {
    // validation
    const refreshSchema = Joi.object({
      refresh_token: Joi.string().required(),
    });

    const { error } = refreshSchema.validate(req.body);

    if (error) {
      return next(error);
    }

    // check in the database

    let refreshtoken;
    try {
      refreshtoken = await RefreshToken.findOne({
        token: req.body.refresh_token,
      });

      if (!refreshtoken) {
        return next(CustomeErrorHandler.unAuthorized("Invalid refresh token"));
      }

      let userId;

      try {
        const { _id } = await JwtService.verify(
          refreshtoken.token,
          REFRESH_SECRET
        );
        userId = _id;
      } catch (err) {}

      const user = User.findOne({ _id: userId });

      if (!user) {
        return next(CustomeErrorHandler.unAuthorized("No user found!"));
      }

      // token

      const access_token = JwtService.sign({
        _id: user._id,
        role: user.role,
      });

      const refresh_token = JwtService.sign(
        { _id: user._id, role: user.role },
        "1y",
        REFRESH_SECRET
      );

      await RefreshToken.create({ token: refresh_token });

      res.json({ access_token, refresh_token });
    } catch (err) {
      return next(new Error("Something went wrong" + err.message));
    }
  },
};

export default refreshController;
