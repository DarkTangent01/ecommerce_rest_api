import { User } from "../models";
import { CustomeErrorHandler } from "../services";

const admin = async (req, res, next) => {
  try {
    const user = await User.findOne({ _id: req.user._id });

    if (user.role === "admin") {
      next();
    } else {
      return next(CustomeErrorHandler.unAuthorized("Invalid User"));
    }
  } catch (err) {
    return next(CustomeErrorHandler.serverError());
  }
};

export default admin;
