import type { Request } from "express";
import type { ClientSession, Types } from "mongoose";
import { DomainEvent } from "../../models/index.js";
import { enqueueJob } from "../../utils/queue.js";
import { logEvent } from "../../utils/requestContext.js";
import type { DomainEventRecord } from "../../models/domainEvent.js";

export interface PublishEventInput {
  type: string;
  aggregateType: string;
  aggregateId?: Types.ObjectId;
  tenant?: string;
  payload?: Record<string, unknown>;
  req?: Partial<Request> | null;
  idempotencyKey?: string;
}

/**
 * Writes the event record. Pass the business transaction's session so the event commits (or rolls
 * back) together with the state change it describes (outbox), then call dispatchEvent after commit.
 */
export const recordEvent = async (
  { type, aggregateType, aggregateId, tenant, payload = {}, req, idempotencyKey }: PublishEventInput,
  session: ClientSession | null = null
) => {
  const [event] = await DomainEvent.create(
    [
      {
        type,
        aggregateType,
        aggregateId,
        tenant,
        payload,
        correlationId: req?.correlationId || req?.requestId,
        causationId: req?.requestId,
        idempotencyKey,
      },
    ],
    session ? { session } : {}
  );
  return event!;
};

/**
 * Queues a recorded event for delivery. The record stays "pending" until a consumer marks it
 * processed, so an event whose dispatch failed can be found and re-queued.
 */
export const dispatchEvent = async (event: Pick<DomainEventRecord, "_id" | "type" | "aggregateType" | "aggregateId">, req?: Partial<Request> | null) => {
  await enqueueJob("domain.event.dispatch", { eventId: event._id, type: event.type });
  logEvent("info", "domain.event.published", req, { eventType: event.type, aggregateType: event.aggregateType, aggregateId: event.aggregateId });
};

export const publishEvent = async (input: PublishEventInput) => {
  const event = await recordEvent(input);
  await dispatchEvent(event, input.req);
  return event;
};

export type EventHandler = (event: Pick<DomainEventRecord, "_id" | "type">) => Promise<unknown>;

export const consumeEvent = async (event: Pick<DomainEventRecord, "_id" | "type">, handlers: Record<string, EventHandler> = {}) => {
  const handler = handlers[event.type];
  if (!handler) return { handled: false };
  await handler(event);
  await DomainEvent.updateOne({ _id: event._id }, { $set: { status: "processed", processedAt: new Date() } });
  return { handled: true };
};
