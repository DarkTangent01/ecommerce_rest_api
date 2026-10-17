const registry = {
  payments: new Map(),
  shipping: new Map(),
  notifications: new Map(),
};

export const registerPlugin = (type, name, implementation) => {
  if (!registry[type]) throw new Error(`Unknown plugin type: ${type}`);
  registry[type].set(name, implementation);
};

export const getPlugin = (type, name) => registry[type]?.get(name);

export const listPlugins = () =>
  Object.fromEntries(Object.entries(registry).map(([type, plugins]) => [type, [...plugins.keys()]]));

registerPlugin("payments", "manual", {
  createPaymentIntent: async ({ order }) => ({ provider: "manual", orderId: order._id, status: "requires_webhook" }),
});

registerPlugin("shipping", "manual", {
  createLabel: async ({ order }) => ({ provider: "manual", orderId: order._id, status: "label_pending" }),
});

registerPlugin("notifications", "log", {
  send: async ({ notification }) => ({ provider: "log", notificationId: notification._id, status: "queued" }),
});
