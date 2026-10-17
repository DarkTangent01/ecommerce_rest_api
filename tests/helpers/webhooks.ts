import { signPayload } from "../../src/utils/webhook.js";
import { api } from "./factories.js";

let seq = 0;

/** Sends a correctly signed payment webhook, the way the provider would. */
export const sendWebhook = (body: Record<string, unknown>, { eventId = `evt_${Date.now()}_${seq++}`, provider = "manual" } = {}) => {
  const payload = JSON.stringify(body);
  const timestamp = Math.floor(Date.now() / 1000).toString();
  return api()
    .post("/api/payments/webhook")
    .set("Content-Type", "application/json")
    .set("X-Webhook-Event-Id", eventId)
    .set("X-Payment-Provider", provider)
    .set("X-Webhook-Timestamp", timestamp)
    .set("X-Webhook-Signature", signPayload(payload, timestamp))
    .send(payload);
};
