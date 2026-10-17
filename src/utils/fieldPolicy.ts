const policies = {
  product: {
    admin: ["name", "description", "price", "size", "category", "sku", "stock", "isActive", "variants"],
    seller: ["name", "description", "price", "size", "category", "sku", "stock", "variants"],
    user: [],
  },
  orderUpdate: {
    admin: ["status", "paymentStatus", "paymentReference", "trackingNumber", "carrier"],
    seller: ["status", "trackingNumber", "carrier"],
    user: [],
  },
} satisfies Record<string, Record<string, string[]>>;

export type PolicyResource = keyof typeof policies;

const allowedFor = (resource: PolicyResource, role: string): string[] =>
  (policies[resource] as Record<string, string[] | undefined>)[role] ?? [];

export const pickAllowedFields = <T extends object>(resource: PolicyResource, role: string, value: T): Partial<T> => {
  const allowed = allowedFor(resource, role);
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key))) as Partial<T>;
};

export const assertNoForbiddenFields = (resource: PolicyResource, role: string, value: object): string[] => {
  const allowed = new Set(allowedFor(resource, role));
  const forbidden = Object.keys(value).filter((key) => !allowed.has(key));
  return forbidden;
};
