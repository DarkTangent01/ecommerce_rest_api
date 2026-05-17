import { openApiController, platformController } from "./controller.js";
import { admin, adminNetworkPolicy, apiKeyAuth, auth, sensitiveLimiter, serviceAuth, stepUpAuth } from "./policy.js";
import { productController } from "../catalog/controller.js";

export const registerPlatformRoutes = (router) => {
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
  router.get("/internal/events", serviceAuth("events:read"), platformController.events);
  router.get("/integrations/products", apiKeyAuth("products:read"), productController.index);
  router.get("/openapi.json", openApiController.show);
  router.get("/api-keys", [auth, admin, adminNetworkPolicy], platformController.listApiKeys);
  router.post("/api-keys", [auth, admin, adminNetworkPolicy, stepUpAuth], platformController.createApiKey);
};
