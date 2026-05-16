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
};

export const pickAllowedFields = (resource, role, value) => {
  const allowed = policies[resource]?.[role] || [];
  return Object.fromEntries(Object.entries(value).filter(([key]) => allowed.includes(key)));
};

export const assertNoForbiddenFields = (resource, role, value) => {
  const allowed = new Set(policies[resource]?.[role] || []);
  const forbidden = Object.keys(value).filter((key) => !allowed.has(key));
  return forbidden;
};
