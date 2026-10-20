import express from "express";
import { registerAnalyticsRoutes } from "./analytics/routes.js";
import { registerAuthRoutes } from "./auth/routes.js";
import { registerCartRoutes } from "./cart/routes.js";
import { registerCatalogRoutes } from "./catalog/routes.js";
import { registerCouponRoutes } from "./coupon/routes.js";
import { registerOrderRoutes } from "./order/routes.js";
import { registerPaymentRoutes } from "./payment/routes.js";
import { registerPlatformRoutes } from "./platform/routes.js";
import { registerReviewRoutes } from "./review/routes.js";
import { registerSellerRoutes } from "./seller/routes.js";
import { registerShipmentRoutes } from "./shipment/routes.js";
import { registerTenantRoutes } from "./tenant/routes.js";
import { registerWishlistRoutes } from "./wishlist/routes.js";

const router = express.Router();

registerPlatformRoutes(router);
registerTenantRoutes(router);
registerAuthRoutes(router);
registerCatalogRoutes(router);
registerCartRoutes(router);
registerOrderRoutes(router);
registerWishlistRoutes(router);
registerReviewRoutes(router);
registerCouponRoutes(router);
registerPaymentRoutes(router);
registerShipmentRoutes(router);
registerAnalyticsRoutes(router);
registerSellerRoutes(router);

export default router;
