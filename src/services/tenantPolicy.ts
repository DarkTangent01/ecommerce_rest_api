import { DEFAULT_TENANT } from "../config/index.js";
import { Tenant } from "../models/index.js";
import { CustomeErrorHandler } from "./index.js";

/**
 * Who may self-register into a tenant (SEC-07). The tenant comes from the client's X-Tenant-Id, so
 * it must name an existing, active tenant that allows sign-up. The default storefront is public
 * even before a Tenant record exists for it. Unknown, suspended and closed tenants get the same
 * answer, so the response does not reveal which tenants exist.
 */
export const assertSelfSignupAllowed = async (tenantKey: string) => {
  const tenant = await Tenant.findOne({ key: tenantKey }).select("status config.allowSelfSignup").lean();
  const implicitDefault = !tenant && tenantKey === DEFAULT_TENANT;
  const open = tenant?.status === "active" && tenant.config?.allowSelfSignup !== false;
  if (!implicitDefault && !open) {
    throw CustomeErrorHandler.forbidden("Registration is not available for this store");
  }
};
