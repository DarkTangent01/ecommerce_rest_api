import express from "express";
const router = express.Router();
import {
  registerController,
  loginController,
  userController,
  refreshController,
  productController,
  cartController,
  orderController,
  wishlistController,
  reviewController,
  couponController,
  shipmentController,
  paymentController,
  analyticsController,
  sellerController,
  openApiController,
  platformController,
  tenantController,
} from "../controllers/index.js";
import auth from "../middlewares/auth.js";
import admin from "../middlewares/admin.js";
import authorize from "../middlewares/authorize.js";
import validateObjectId from "../middlewares/validateObjectId.js";
import { authLimiter, checkoutLimiter, couponLimiter, reviewLimiter, sensitiveLimiter } from "../middlewares/rateLimiters.js";
import idempotency from "../middlewares/idempotency.js";
import adminNetworkPolicy from "../middlewares/adminNetworkPolicy.js";
import stepUpAuth from "../middlewares/stepUpAuth.js";
import apiKeyAuth from "../middlewares/apiKeyAuth.js";
import serviceAuth from "../middlewares/serviceAuth.js";

router.get("/health", (req, res) => {
  res.json({
    success: true,
    message: "OK",
    data: {
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
    },
  });
});
router.get("/ready", platformController.readiness);
router.get("/metrics", [auth, admin, adminNetworkPolicy], platformController.metrics);
router.get("/platform/services", [auth, admin, adminNetworkPolicy], platformController.serviceCatalog);
router.get("/platform/events", [auth, admin, adminNetworkPolicy], platformController.events);
router.get("/platform/sagas", [auth, admin, adminNetworkPolicy], platformController.sagas);
router.get("/platform/security-signals", [auth, admin, adminNetworkPolicy], platformController.securitySignals);
router.get("/platform/audit-trail", [auth, admin, adminNetworkPolicy], platformController.auditTrail);
router.get("/platform/security-headers", platformController.securityHeaders);
router.get("/platform/signed-url", [auth, sensitiveLimiter], platformController.signedUrl);
router.get("/platform/validate-signed-url", platformController.validateSignedUrl);
router.get("/platform/stream", auth, platformController.stream);
router.get("/tenant", auth, tenantController.current);
router.put("/tenant", [auth, admin, adminNetworkPolicy], tenantController.upsert);
router.get("/internal/events", serviceAuth("events:read"), platformController.events);
router.get("/integrations/products", apiKeyAuth("products:read"), productController.index);
router.get("/openapi.json", openApiController.show);

router.post("/register", authLimiter, registerController.register);
router.post("/login", authLimiter, loginController.login);
router.get("/users", auth, userController.users);
router.get("/users/export", auth, userController.exportData);
router.delete("/users/me", [auth, sensitiveLimiter, stepUpAuth], userController.deleteData);
router.post("/refresh", authLimiter, refreshController.refresh);
router.post("/logout", auth, sensitiveLimiter, loginController.logout);

// Product Routes
router.post("/products", [auth, authorize("admin", "seller")], productController.store);
router.put("/products/:id", [auth, authorize("admin", "seller"), validateObjectId("id")], productController.update);
router.delete("/products/:id", [auth, admin, validateObjectId("id")], productController.destroy);
router.get("/products", productController.index);
router.get("/products/:id", validateObjectId("id"), productController.show);

// Cart Routes
router.get("/cart", auth, cartController.show);
router.post("/cart/items", auth, sensitiveLimiter, cartController.addItem);
router.put("/cart/items", auth, sensitiveLimiter, cartController.updateItem);
router.delete("/cart/items/:productId", [auth, sensitiveLimiter, validateObjectId("productId")], cartController.removeItem);
router.delete("/cart", auth, sensitiveLimiter, cartController.clear);

// Order Routes
router.post("/orders/checkout", auth, stepUpAuth, checkoutLimiter, idempotency, orderController.checkout);
router.get("/orders", auth, orderController.index);
router.get("/orders/:id", [auth, validateObjectId("id")], orderController.show);
router.post("/orders/:id/cancel", [auth, sensitiveLimiter, validateObjectId("id")], orderController.cancel);
router.post("/orders/:id/refund", [auth, sensitiveLimiter, validateObjectId("id")], orderController.requestRefund);

// Wishlist Routes
router.get("/wishlist", auth, wishlistController.show);
router.post("/wishlist/:productId", [auth, sensitiveLimiter, validateObjectId("productId")], wishlistController.add);
router.delete("/wishlist/:productId", [auth, sensitiveLimiter, validateObjectId("productId")], wishlistController.remove);

// Review Routes
router.get("/products/:productId/reviews", validateObjectId("productId"), reviewController.index);
router.post("/products/:productId/reviews", [auth, reviewLimiter, validateObjectId("productId")], reviewController.create);

// Coupon Routes
router.get("/coupons", [auth, admin, adminNetworkPolicy], couponController.index);
router.post("/coupons", [auth, admin, adminNetworkPolicy, couponLimiter], couponController.store);
router.put("/coupons/:id", [auth, admin, adminNetworkPolicy, couponLimiter, validateObjectId("id")], couponController.update);
router.get("/api-keys", [auth, admin, adminNetworkPolicy], platformController.listApiKeys);
router.post("/api-keys", [auth, admin, adminNetworkPolicy, stepUpAuth], platformController.createApiKey);

// Payment and fulfillment routes
router.post("/payments/webhook", paymentController.webhook);
router.put("/orders/:orderId/shipment", [auth, authorize("admin", "seller"), validateObjectId("orderId")], shipmentController.upsert);

// Dashboards
router.get("/admin/analytics", [auth, admin, adminNetworkPolicy], analyticsController.admin);
router.get("/seller/dashboard", [auth, authorize("seller", "admin")], sellerController.dashboard);

export default router;
