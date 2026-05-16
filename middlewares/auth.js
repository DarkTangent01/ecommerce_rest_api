import { CustomeErrorHandler, JwtService } from "../services/index.js";
import { User } from "../models/index.js";

const auth = async (req, res, next) => {
  let authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(CustomeErrorHandler.unAuthorized());
  }

  const token = authHeader.split(" ")[1];

  try {
    const { _id, role } = await JwtService.verify(token);
    const user = await User.findOne({ _id, isActive: true, deletedAt: null }).select("_id role email name tenant");

    if (!user) {
      return next(CustomeErrorHandler.unAuthorized("Account is inactive or does not exist"));
    }

    req.user = {
      _id: user._id,
      role: role || user.role,
      email: user.email,
      name: user.name,
      tenant: user.tenant,
    };
    req.tenant = user.tenant || req.tenant;
    next();
  } catch (err) {
    return next(CustomeErrorHandler.unAuthorized());
  }
};

export default auth;
