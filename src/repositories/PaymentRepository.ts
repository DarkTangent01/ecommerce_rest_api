import type { HydratedDocument, Types } from "mongoose";
import { InventoryReservation, Order, PaymentEvent, Product } from "../models/index.js";
import type { InventoryReservation as Reservation, Order as OrderShape, Payment } from "../types/domain.js";

type Id = Types.ObjectId | string;

class PaymentRepository {
  findEvent(provider: string, eventId: string) {
    return PaymentEvent.findOne({ provider, eventId });
  }

  createEvent(data: Pick<Payment, "provider" | "eventId" | "type" | "payloadHash"> & { order: Id }) {
    return PaymentEvent.create(data);
  }

  findOrderById(orderId: Id) {
    return Order.findById(orderId);
  }

  saveOrder(order: HydratedDocument<OrderShape>) {
    return order.save();
  }

  commitReservations(orderId: Id) {
    return InventoryReservation.updateMany({ order: orderId, status: "reserved" }, { $set: { status: "committed" } });
  }

  findActiveReservations(orderId: Id) {
    return InventoryReservation.find({ order: orderId, status: { $in: ["reserved", "committed"] } });
  }

  restoreProductStock(productId: Id, quantity: number) {
    return Product.updateOne({ _id: productId }, { $inc: { stock: quantity } });
  }

  saveReservation(reservation: HydratedDocument<Reservation>) {
    return reservation.save();
  }
}

export default PaymentRepository;
