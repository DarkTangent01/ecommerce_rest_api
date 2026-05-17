import { orderController } from "./controller.js";
import { auth, checkoutLimiter, idempotency, sensitiveLimiter, stepUpAuth } from "./policy.js";
import validateObjectId from "../../../middlewares/validateObjectId.js";

export const registerOrderRoutes = (router) => {
  router.post("/orders/checkout", auth, stepUpAuth, checkoutLimiter, idempotency, orderController.checkout);
  router.get("/orders", auth, orderController.index);
  router.get("/orders/:id", [auth, validateObjectId("id")], orderController.show);
  router.post("/orders/:id/cancel", [auth, sensitiveLimiter, validateObjectId("id")], orderController.cancel);
  router.post("/orders/:id/refund", [auth, sensitiveLimiter, validateObjectId("id")], orderController.requestRefund);
};
