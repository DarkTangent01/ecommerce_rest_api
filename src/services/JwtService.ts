import { JWT_SECRET } from "../config/index.js";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import crypto from "crypto";

const ISSUER = "ecommerce-rest-api";
const AUDIENCE = "ecommerce-rest-api-clients";
// Pinned so a token can never select its own verification algorithm.
const ALGORITHM = "HS256";

class JwtService {
  static sign(payload: object, expiry: string | number = "15m", secret: string = JWT_SECRET): string {
    return jwt.sign(payload, secret, {
      algorithm: ALGORITHM,
      // TODO: env-provided TTLs are validated strings ("15m", "7d"); jsonwebtoken's StringValue type is a template literal.
      expiresIn: expiry as SignOptions["expiresIn"],
      issuer: ISSUER,
      audience: AUDIENCE,
      jwtid: crypto.randomUUID(),
    });
  }

  /** Verifies a token and returns its claims. Throws if the token is invalid or not an object payload. */
  static verify<T extends object = Record<string, unknown>>(token: string, secret: string = JWT_SECRET): T & JwtPayload {
    const decoded = jwt.verify(token, secret, {
      algorithms: [ALGORITHM],
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
