export const serviceCatalog = {
  auth: {
    owns: ["users", "refreshTokens", "sessions", "apiKeys"],
    publishes: ["auth.login_failed", "auth.login_succeeded", "user.deleted"],
    consumes: [],
  },
  catalog: {
    owns: ["products", "reviews", "wishlist"],
    publishes: ["inventory.reserved", "catalog.product_updated", "review.created"],
    consumes: ["order.cancelled", "payment.failed"],
  },
  order: {
    owns: ["orders", "carts", "coupons", "inventoryReservations"],
    publishes: ["order.created", "order.cancelled", "refund.requested"],
    consumes: ["payment.completed", "payment.failed", "shipment.updated"],
  },
  payment: {
    owns: ["paymentEvents", "paymentAttempts"],
    publishes: ["payment.completed", "payment.failed", "payment.refunded"],
    consumes: ["order.created"],
  },
  notification: {
    owns: ["notifications"],
    publishes: ["notification.sent", "notification.failed"],
    consumes: ["order.created", "payment.completed", "shipment.updated"],
  },
};

export const serviceBoundaryForRoute = (path = "") => {
  if (path.includes("/login") || path.includes("/register") || path.includes("/users")) return "auth";
  if (path.includes("/products") || path.includes("/wishlist") || path.includes("/reviews")) return "catalog";
  if (path.includes("/orders") || path.includes("/cart") || path.includes("/coupons")) return "order";
  if (path.includes("/payments")) return "payment";
  return "platform";
};
