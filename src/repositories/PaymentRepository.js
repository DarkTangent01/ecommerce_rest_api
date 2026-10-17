import { InventoryReservation, Order, PaymentEvent, Product } from "../models/index.js";

class PaymentRepository {
  findEvent(provider, eventId) {
    return PaymentEvent.findOne({ provider, eventId });
  }

  createEvent(data) {
    return PaymentEvent.create(data);
  }

  findOrderById(orderId) {
    return Order.findById(orderId);
  }

  saveOrder(order) {
    return order.save();
  }

  commitReservations(orderId) {
    return InventoryReservation.updateMany({ order: orderId, status: "reserved" }, { $set: { status: "committed" } });
  }

  findActiveReservations(orderId) {
    return InventoryReservation.find({ order: orderId, status: { $in: ["reserved", "committed"] } });
  }

  restoreProductStock(productId, quantity) {
    return Product.updateOne({ _id: productId }, { $inc: { stock: quantity } });
  }

  saveReservation(reservation) {
    return reservation.save();
  }
}

export default PaymentRepository;
