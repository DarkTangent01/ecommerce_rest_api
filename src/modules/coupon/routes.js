import { couponController } from "./controller.js";
import { admin, adminNetworkPolicy, auth, couponLimiter } from "./policy.js";
import validateObjectId from "../../../middlewares/validateObjectId.js";

export const registerCouponRoutes = (router) => {
  router.get("/coupons", [auth, admin, adminNetworkPolicy], couponController.index);
  router.post("/coupons", [auth, admin, adminNetworkPolicy, couponLimiter], couponController.store);
  router.put("/coupons/:id", [auth, admin, adminNetworkPolicy, couponLimiter, validateObjectId("id")], couponController.update);
};
