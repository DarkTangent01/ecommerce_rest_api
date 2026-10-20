import type { Request } from "express";
import CustomeErrorHandler from "../services/CustomeErrorHandler.js";
import type { AuthUser } from "./domain.js";

/** A request that has passed the `auth` middleware. */
export type AuthedRequest = Request & { user: AuthUser };

/**
 * Narrows `req` to an authenticated request. Routes mount `auth` before their handlers,
 * so this only fails if a route is wired without it, which is answered with 401.
 */
export function assertAuthed(req: Request): asserts req is AuthedRequest {
  if (!req.user) throw CustomeErrorHandler.unAuthorized();
}
