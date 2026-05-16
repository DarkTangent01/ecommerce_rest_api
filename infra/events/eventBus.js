import { DomainEvent } from "../../models/index.js";
import { enqueueJob } from "../../utils/queue.js";
import { logEvent } from "../../utils/requestContext.js";

export const publishEvent = async ({ type, aggregateType, aggregateId, tenant, payload = {}, req, idempotencyKey }) => {
  const event = await DomainEvent.create({
    type,
    aggregateType,
    aggregateId,
    tenant,
    payload,
    correlationId: req?.correlationId || req?.requestId,
    causationId: req?.requestId,
    idempotencyKey,
  });

  await enqueueJob("domain.event.dispatch", { eventId: event._id, type });
  logEvent("info", "domain.event.published", req, { eventType: type, aggregateType, aggregateId });
  return event;
};

export const consumeEvent = async (event, handlers = {}) => {
  const handler = handlers[event.type];
  if (!handler) return { handled: false };
  await handler(event);
  await DomainEvent.updateOne({ _id: event._id }, { $set: { status: "processed", processedAt: new Date() } });
  return { handled: true };
};
