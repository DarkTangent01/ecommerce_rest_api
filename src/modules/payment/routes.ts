import type { Router } from "express";
import { paymentController } from "./controller.js";

export const registerPaymentRoutes = (router: Router) => {
  router.post("/payments/webhook", paymentController.webhook);
};
