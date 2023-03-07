import { User } from "../../models";
import { ObjectId } from "mongodb";
import { CustomeErrorHandler } from "../../services";

const userControllers = {
  async users(req, res, next) {
    try {
      const _id = new ObjectId(req.user._id);
      const user = await User.findById(_id).select("-password");
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
