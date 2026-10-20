import type { Router } from "express";
import { tenantController } from "./controller.js";
import { admin, adminNetworkPolicy, auth } from "./policy.js";

export const registerTenantRoutes = (router: Router) => {
  router.get("/tenant", auth, tenantController.current);
  router.put("/tenant", [auth, admin, adminNetworkPolicy], tenantController.upsert);
};
