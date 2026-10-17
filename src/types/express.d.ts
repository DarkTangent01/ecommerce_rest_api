import type { AuthUser } from "./domain.js";

// Properties the middleware chain attaches to every request.
declare global {
  namespace Express {
    interface Request {
      /** Set by requestContext. */
      requestId: string;
      /** Set by requestContext. */
      correlationId: string;
      /** Set by tenantContext, then overridden by auth/apiKeyAuth with the principal's tenant. */
      tenant: string;
      /** Set by auth. Undefined on public routes. */
      user?: AuthUser;
      /** Raw JSON body captured for webhook signature checks. */
      rawBody?: string;
      /** Set by apiKeyAuth. */
      apiKey?: { _id: unknown; tenant: string; scopes: string[] };
      /** Set by serviceAuth. */
      service?: string;
      /** Set by stepUpAuth. */
      sessionContext?: { stepUpRequired: boolean };
      /** Set by the idempotency middleware. */
      idempotencyRecord?: {
        response?: unknown;
        statusCode?: number;
        status: "processing" | "completed" | "failed";
        save(): Promise<unknown>;
        deleteOne(): Promise<unknown>;
      };
    }
  }

  var appRoot: string | undefined;
}

export {};
