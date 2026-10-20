import bcrypt from "bcrypt";
import type { Request } from "express";
import type { Types } from "mongoose";
import { ACCESS_TOKEN_TTL, BCRYPT_ROUNDS, REFRESH_SECRET, REFRESH_TOKEN_TTL } from "../config/index.js";
import { CustomeErrorHandler, JwtService } from "./index.js";
import { linkSessionToRefreshToken, recordSecuritySignal, trackSession } from "./securityService.js";
import { UserSession } from "../models/index.js";
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
  /**
   * The UserSession this token belongs to. Step-up decisions are made for this session, never for a
   * client-supplied device id (SEC-02). Absent on tokens issued before the claim existed.
   */
  sid?: string;
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

  createTokenPair(user: { _id: Types.ObjectId; role: Role }, sessionId?: Types.ObjectId | string): TokenPair {
    const payload = { _id: user._id, role: user.role, ...(sessionId && { sid: String(sessionId) }) };
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

    return (await this.startSession(user, req)).tokens;
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

    const { tokens, session } = await this.startSession(user, req);
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

  /** Creates (or reuses, per device) the session first, so its id can be signed into both tokens. */
  private async startSession(user: { _id: Types.ObjectId; role: Role }, req: Request) {
    const session = await trackSession({ user, req });
    const tokens = this.createTokenPair(user, session._id);
    const savedRefreshToken = await this.repository.createRefreshToken({
      token: tokens.refresh_token,
      user: user._id,
      expiresAt: this.refreshExpiry(),
    });
    await linkSessionToRefreshToken(session._id, savedRefreshToken._id);
    return { tokens, session };
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

    // Tokens issued before the sid claim existed find their session through the refresh token it holds.
    const sessionId = claims.sid ?? (await UserSession.findOne({ user: user._id, refreshToken: refreshToken._id }).select("_id"))?._id;
    const tokens = this.createTokenPair(user, sessionId);
    const savedRefreshToken = await this.repository.createRefreshToken({
      token: tokens.refresh_token,
      user: user._id,
      expiresAt: this.refreshExpiry(),
    });
    if (sessionId) await linkSessionToRefreshToken(sessionId, savedRefreshToken._id);
    return tokens;
  }

  async logout(refreshToken: string, userId: Types.ObjectId | string) {
    await this.repository.deleteRefreshTokenForUser(refreshToken, userId);
  }
}

export default AuthService;
