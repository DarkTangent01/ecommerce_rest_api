import type { Router } from "express";
import { sellerController } from "./controller.js";
import { SellerPolicy } from "./policy.js";
import auth from "../../middlewares/auth.js";

export const registerSellerRoutes = (router: Router) => {
  router.get("/seller/dashboard", [auth, SellerPolicy.sellerOrAdmin()], sellerController.dashboard);
};
