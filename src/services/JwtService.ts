import { JWT_SECRET } from "../config/index.js";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import crypto from "crypto";

const ISSUER = "ecommerce-rest-api";
const AUDIENCE = "ecommerce-rest-api-clients";

class JwtService {
  static sign(payload: object, expiry: string | number = "15m", secret: string = JWT_SECRET): string {
    return jwt.sign(payload, secret, {
      // TODO: env-provided TTLs are free-form strings ("15m", "7d"); jsonwebtoken validates them at runtime.
      expiresIn: expiry as SignOptions["expiresIn"],
      issuer: ISSUER,
      audience: AUDIENCE,
      jwtid: crypto.randomUUID(),
    });
  }

  /** Verifies a token and returns its claims. Throws if the token is invalid or not an object payload. */
  static verify<T extends object = Record<string, unknown>>(token: string, secret: string = JWT_SECRET): T & JwtPayload {
    const decoded = jwt.verify(token, secret, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    if (typeof decoded === "string") {
      throw new jwt.JsonWebTokenError("Unexpected string token payload");
    }
    return decoded as T & JwtPayload;
  }
}

export default JwtService;
