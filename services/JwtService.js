import { JWT_SECRET } from "../config/index.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";
class JwtService {
  static sign(payload, expiry = "15m", secret = JWT_SECRET) {
    return jwt.sign(payload, secret, {
      expiresIn: expiry,
      issuer: "ecommerce-rest-api",
      audience: "ecommerce-rest-api-clients",
      jwtid: crypto.randomUUID(),
    });
  }
  static verify(token, secret = JWT_SECRET) {
    return jwt.verify(token, secret, {
      issuer: "ecommerce-rest-api",
      audience: "ecommerce-rest-api-clients",
    });
  }
}

export default JwtService;
