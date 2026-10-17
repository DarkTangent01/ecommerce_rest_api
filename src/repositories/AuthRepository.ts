import type { Types } from "mongoose";
import { RefreshToken, User } from "../models/index.js";

type Id = Types.ObjectId | string;

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
    return RefreshToken.create(data);
  }

  findActiveRefreshToken(token: string) {
    return RefreshToken.findOne({ token, revokedAt: null });
  }

  deleteRefreshTokenForUser(token: string, userId: Id) {
    return RefreshToken.deleteOne({ token, user: userId });
  }
}

export default AuthRepository;
