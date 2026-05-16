import { DEBUG_MODE } from "../config/index.js";
import Joi from "joi";
import CustomeErrorHandler from "../services/CustomeErrorHandler.js";
import { errorResponse } from "../utils/apiResponse.js";

const { ValidationError } = Joi;

const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let message = "Internal server error";
  let details;

  if (err instanceof ValidationError) {
    statusCode = 422;
    message = "Validation failed";
    details = err.details?.map((detail) => ({
      field: detail.path.join("."),
      message: detail.message.replace(/"/g, ""),
    }));
  } else if (err instanceof CustomeErrorHandler) {
    statusCode = err.status;
    message = err.message;
  } else {
    console.error(err);
  }

  // Validate the status code
  if (statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  if (DEBUG_MODE && statusCode >= 500) {
    details = { stack: err.stack };
  }

  return errorResponse(res, message, statusCode, details);
};

export default errorHandler;
