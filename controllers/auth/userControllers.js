import { User } from "../../models";
import { CustomeErrorHandler } from "../../services";

const userControllers = {
  async users(req, res, next) {
    try {
      const user = await User.findOne({ _id: req.user._id }).select(
        "-password -updatedAt -__v"
      );
      if (!user) {
        return next(CustomeErrorHandler.notFound());
      }

      res.json(user);
    } catch (err) {
      return next(err);
    }
  },
};

export default userControllers;
