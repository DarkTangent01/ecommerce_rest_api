import mongoose from "mongoose";
import { CustomeErrorHandler } from "../services/index.js";

const validateObjectId = (paramName = "id") => (req, res, next) => {
  if (!mongoose.Types.ObjectId.isValid(req.params[paramName])) {
    return next(CustomeErrorHandler.badRequest("Invalid resource id"));
  }

  return next();
};

export default validateObjectId;
