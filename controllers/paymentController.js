import { successResponse } from "../utils/apiResponse.js";
import PaymentService from "../services/PaymentService.js";

class PaymentController {
  constructor(paymentService = new PaymentService()) {
    this.paymentService = paymentService;
    this.webhook = this.webhook.bind(this);
  }

  async webhook(req, res, next) {
    try {
      const result = await this.paymentService.processWebhook({
        headers: {
          signature: req.get("X-Webhook-Signature"),
          timestamp: req.get("X-Webhook-Timestamp"),
          provider: req.get("X-Payment-Provider"),
          eventId: req.get("X-Webhook-Event-Id"),
        },
        body: req.body,
        rawPayload: req.rawBody || JSON.stringify(req.body || {}),
        req,
      });

      if (result.replay) {
        return successResponse(res, { replay: true }, "Webhook already processed");
      }
      return successResponse(res, result.order, "Webhook processed");
    } catch (err) {
      if (err.code === 11000) return successResponse(res, { replay: true }, "Webhook already processed");
      return next(err);
    }
  }
}

export default new PaymentController();
