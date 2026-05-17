import { RefreshToken, User } from "../models/index.js";

class AuthRepository {
  findUserByEmail(email, projection = "") {
    const query = User.findOne({ email, isActive: true, deletedAt: null });
    return projection ? query.select(projection) : query;
  }

  findUserById(userId, projection = "") {
    const query = User.findOne({ _id: userId, isActive: true, deletedAt: null });
    return projection ? query.select(projection) : query;
  }

  userExistsByEmail(email) {
    return User.exists({ email });
  }

  createUser(data) {
    return User.create(data);
  }

  createRefreshToken(data) {
    return RefreshToken.create(data);
  }

  findActiveRefreshToken(token) {
    return RefreshToken.findOne({ token, revokedAt: null });
  }

  deleteRefreshTokenForUser(token, userId) {
    return RefreshToken.deleteOne({ token, user: userId });
  }
}

export default AuthRepository;
