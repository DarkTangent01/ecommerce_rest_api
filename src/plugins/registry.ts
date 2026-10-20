type PluginType = "payments" | "shipping" | "notifications";

// Plugin contracts are provider-specific and not modelled yet, so implementations are opaque here.
type PluginImplementation = Record<string, (...args: never[]) => Promise<unknown>>;

const registry: Record<PluginType, Map<string, PluginImplementation>> = {
  payments: new Map(),
  shipping: new Map(),
  notifications: new Map(),
};

const isPluginType = (type: string): type is PluginType => Object.hasOwn(registry, type);

export const registerPlugin = (type: string, name: string, implementation: PluginImplementation) => {
  if (!isPluginType(type)) throw new Error(`Unknown plugin type: ${type}`);
  registry[type].set(name, implementation);
};

export const getPlugin = (type: string, name: string) => (isPluginType(type) ? registry[type].get(name) : undefined);

export const listPlugins = () =>
  Object.fromEntries(Object.entries(registry).map(([type, plugins]) => [type, [...plugins.keys()]]));

registerPlugin("payments", "manual", {
  createPaymentIntent: async ({ order }: { order: { _id: unknown } }) => ({ provider: "manual", orderId: order._id, status: "requires_webhook" }),
});

registerPlugin("shipping", "manual", {
  createLabel: async ({ order }: { order: { _id: unknown } }) => ({ provider: "manual", orderId: order._id, status: "label_pending" }),
});

registerPlugin("notifications", "log", {
  send: async ({ notification }: { notification: { _id: unknown } }) => ({
    provider: "log",
    notificationId: notification._id,
    status: "queued",
  }),
});
