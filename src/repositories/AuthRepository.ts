import crypto from "crypto";
import type { Types } from "mongoose";
import { RefreshToken, User } from "../models/index.js";

type Id = Types.ObjectId | string;

/** Refresh tokens are stored as SHA-256 digests so a database leak does not yield usable tokens. */
export const hashRefreshToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");

// Rows written before hashing was introduced hold the raw token; accept both until they expire.
const tokenLookup = (token: string) => ({ $in: [hashRefreshToken(token), token] });

class AuthRepository {
  findUserByEmail(email: string, projection = "") {
    const query = User.findOne({ email, isActive: true, deletedAt: null });
    return projection ? query.select(projection) : query;
  }

  findUserById(userId: Id, projection = "") {
    const query = User.findOne({ _id: userId, isActive: true, deletedAt: null });
    return projection ? query.select(projection) : query;
  }

  userExistsByEmail(email: string) {
    return User.exists({ email });
  }

  createUser(data: { name: string; email: string; password: string; tenant: string }) {
    return User.create(data);
  }

  createRefreshToken(data: { token: string; user: Id; expiresAt: Date }) {
    return RefreshToken.create({ ...data, token: hashRefreshToken(data.token) });
  }

  findActiveRefreshToken(token: string) {
    return RefreshToken.findOne({ token: tokenLookup(token), revokedAt: null });
  }

  /**
   * Atomically revokes an active, unexpired refresh token and returns it, or null if it was
   * unknown, expired or already used. Two concurrent refreshes can therefore not both succeed.
   */
  consumeRefreshToken(token: string) {
    return RefreshToken.findOneAndUpdate(
      { token: tokenLookup(token), revokedAt: null, expiresAt: { $gt: new Date() } },
      { $set: { revokedAt: new Date() } },
      { new: true }
    );
  }

  deleteRefreshTokenForUser(token: string, userId: Id) {
    return RefreshToken.deleteOne({ token: tokenLookup(token), user: userId });
  }
}

export default AuthRepository;
