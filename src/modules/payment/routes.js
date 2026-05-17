import { paymentController } from "./controller.js";

export const registerPaymentRoutes = (router) => {
  router.post("/payments/webhook", paymentController.webhook);
};
