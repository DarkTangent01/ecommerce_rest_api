import { SagaInstance } from "../../models/index.js";
import { publishEvent } from "../events/eventBus.js";

export const startOrderSaga = async ({ order, tenant, req }) => {
  const saga = await SagaInstance.create({
    type: "order_checkout",
    aggregateId: order._id,
    tenant,
    steps: [
      { name: "order.created", status: "completed", completedAt: new Date() },
      { name: "inventory.reserved", status: "completed", completedAt: new Date() },
      { name: "payment.pending", status: "pending" },
      { name: "shipment.pending", status: "pending" },
    ],
  });

  await publishEvent({
    type: "order.created",
    aggregateType: "order",
    aggregateId: order._id,
    tenant,
    payload: { orderId: order._id, total: order.total, user: order.user },
    req,
  });

  return saga;
};

export const compensateOrderSaga = async ({ order, reason, req }) => {
  await SagaInstance.updateOne(
    { aggregateId: order._id, type: "order_checkout" },
    {
      $set: { status: "compensating" },
      $push: { compensations: { name: "release_inventory", reason, at: new Date() } },
    }
  );

  await publishEvent({
    type: "order.compensation_requested",
    aggregateType: "order",
    aggregateId: order._id,
    tenant: order.tenant,
    payload: { orderId: order._id, reason },
    req,
  });
};
