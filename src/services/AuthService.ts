import bcrypt from "bcrypt";
import type { Request } from "express";
import type { Types } from "mongoose";
import { ACCESS_TOKEN_TTL, BCRYPT_ROUNDS, REFRESH_SECRET, REFRESH_TOKEN_TTL } from "../config/index.js";
import { CustomeErrorHandler, JwtService } from "./index.js";
import { recordSecuritySignal, trackSession } from "./securityService.js";
import AuthRepository from "../repositories/AuthRepository.js";
import type { Role } from "../types/domain.js";
import { parseDurationMs } from "../utils/duration.js";

export interface TokenPair {
  access_token: string;
  refresh_token: string;
}

export type TokenType = "access" | "refresh";

export interface AccessTokenClaims {
  _id: string;
  /** Informational only: authorization always uses the role stored on the user. */
  role?: Role;
  /** Absent on tokens issued before this claim existed. */
  typ?: TokenType;
}

class AuthService {
  repository: AuthRepository;

  constructor(repository = new AuthRepository()) {
    this.repository = repository;
  }

  refreshExpiry() {
    // Matches the JWT lifetime exactly (previously "12h" was read as 12 days).
    return new Date(Date.now() + parseDurationMs(REFRESH_TOKEN_TTL));
  }

  createTokenPair(user: { _id: Types.ObjectId; role: Role }): TokenPair {
    const payload = { _id: user._id, role: user.role };
    return {
      access_token: JwtService.sign({ ...payload, typ: "access" }, ACCESS_TOKEN_TTL),
      refresh_token: JwtService.sign({ ...payload, typ: "refresh" }, REFRESH_TOKEN_TTL, REFRESH_SECRET),
    };
  }

  async register({ name, email, password, tenant, req }: { name: string; email: string; password: string; tenant: string; req: Request }) {
    const exists = await this.repository.userExistsByEmail(email);
    if (exists) {
      throw CustomeErrorHandler.alreadyExist("This email is already taken.");
    }

    const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const user = await this.repository.createUser({
      name,
      email,
      password: hashedPassword,
      tenant,
    });

    const tokens = this.createTokenPair(user);
    const savedRefreshToken = await this.repository.createRefreshToken({
      token: tokens.refresh_token,
      user: user._id,
      expiresAt: this.refreshExpiry(),
    });
    await trackSession({ user, refreshToken: savedRefreshToken._id, req });
    return tokens;
  }

  async login({ email, password, tenant, ip, req }: { email: string; password: string; tenant: string; ip?: string; req: Request }) {
    const user = await this.repository.findUserByEmail(email, "+password role email name tenant");
    if (!user) {
      await recordSecuritySignal({ type: "auth.login_failed", severity: "medium", tenant, ip, metadata: { email } });
      throw CustomeErrorHandler.wrongCredentials();
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      await recordSecuritySignal({ type: "auth.login_failed", severity: "medium", user: user._id, tenant, ip });
      throw CustomeErrorHandler.wrongCredentials();
    }

    const tokens = this.createTokenPair(user);
    const savedRefreshToken = await this.repository.createRefreshToken({
      token: tokens.refresh_token,
      user: user._id,
      expiresAt: this.refreshExpiry(),
    });
    const session = await trackSession({ user, refreshToken: savedRefreshToken._id, req });
    await recordSecuritySignal({
      type: "auth.login_succeeded",
      severity: session.stepUpRequired ? "medium" : "info",
      user: user._id,
      tenant,
      ip,
      metadata: { stepUpRequired: session.stepUpRequired },
    });

    return { ...tokens, step_up_required: session.stepUpRequired };
  }

  async refresh(refreshTokenValue: string): Promise<TokenPair> {
    let claims: AccessTokenClaims;
    try {
      claims = JwtService.verify<AccessTokenClaims>(refreshTokenValue, REFRESH_SECRET);
    } catch {
      throw CustomeErrorHandler.unAuthorized("Invalid refresh token");
    }
    if (claims.typ && claims.typ !== "refresh") {
      throw CustomeErrorHandler.unAuthorized("Invalid refresh token");
    }

    // Rotation: the presented token is revoked atomically, so it can be exchanged exactly once.
    const refreshToken = await this.repository.consumeRefreshToken(refreshTokenValue);
    if (!refreshToken || String(refreshToken.user) !== String(claims._id)) {
      throw CustomeErrorHandler.unAuthorized("Invalid refresh token");
    }

    const user = await this.repository.findUserById(claims._id);
    if (!user) {
      throw CustomeErrorHandler.unAuthorized("No user found!");
    }

    const tokens = this.createTokenPair(user);
    await this.repository.createRefreshToken({
      token: tokens.refresh_token,
      user: user._id,
      expiresAt: this.refreshExpiry(),
    });
    return tokens;
  }

  async logout(refreshToken: string, userId: Types.ObjectId | string) {
    await this.repository.deleteRefreshTokenForUser(refreshToken, userId);
  }
}

export default AuthService;
