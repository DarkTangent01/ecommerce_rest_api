import { DEBUG_MODE } from "../config";
import { ValidationError } from "joi";
import CustomeErrorHandler from "../services/CustomeErrorHandler";

const errorHandler = (err, req, res, next) => {
  let statusCode = 500;
  let data = {
    message: "Internal server error",
  };

  if (err instanceof ValidationError) {
    statusCode = 422;
    data = {
      message: err.message,
    };
  }

  if (err instanceof CustomeErrorHandler) {
    statusCode = err.status;
    data = {
      message: err.message,
    };
  } else {
    console.error(err);
  }

  // Validate the status code
  if (statusCode < 100 || statusCode > 599) {
    statusCode = 500;
  }

  return res.status(statusCode).json(data);
};

export default errorHandler;
