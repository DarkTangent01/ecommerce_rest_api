import { CustomeErrorHandler, JwtService } from "../services";

const auth = async (req, res, next) => {
  let authHeader = req.headers.authorization;

  if (!authHeader) {
    return next(CustomeErrorHandler.unAuthorized());
  }

  const token = authHeader.split(" ")[1];

  try {
    const { _id, role } = await JwtService.verify(token);

    const user = {
      _id,
      role,
    };

    req.user = user;
    next();
    
    // req.user = {};
    // req.user._id = _id;
    // req.user.role = role;
  } catch (err) {
    return next(CustomeErrorHandler.unAuthorized());
  }
};

export default auth;
