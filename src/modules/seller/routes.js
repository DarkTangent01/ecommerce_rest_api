import { sellerController } from "./controller.js";
import { SellerPolicy } from "./policy.js";
import auth from "../../../middlewares/auth.js";

export const registerSellerRoutes = (router) => {
  router.get("/seller/dashboard", [auth, SellerPolicy.sellerOrAdmin()], sellerController.dashboard);
};
