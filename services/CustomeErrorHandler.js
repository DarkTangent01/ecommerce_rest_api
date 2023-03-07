class CustomeErrorHandler extends Error {
  constructor(status, msg) {
    super();
    this.status = status;
    this.message = msg.replace(/[^\w\s]/gi, '');
  }

  static alreadyExist(message) {
    return new CustomeErrorHandler(409, message);
  }

  static wrongCredentials(message = "Username or Password is wrong!") {
    return new CustomeErrorHandler(401, message);
  }

  static unAuthorized(message = "unAuthorized") {
    return new CustomeErrorHandler(401, message);
  }

  static notFound(message = "404 Not Found") {
    return new CustomeErrorHandler(404, message);
  }

  static serverError(message = "Internal server error") {
    return new CustomeErrorHandler(500, message);
  }

  static toManyRequest(message = "To many request, Try again later."){
    return new CustomeErrorHandler(429, message); 
  }
}

export default CustomeErrorHandler;
