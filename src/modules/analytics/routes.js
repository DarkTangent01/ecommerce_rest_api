import { analyticsController } from "./controller.js";
import { admin, adminNetworkPolicy, auth } from "./policy.js";

export const registerAnalyticsRoutes = (router) => {
  router.get("/admin/analytics", [auth, admin, adminNetworkPolicy], analyticsController.admin);
};
