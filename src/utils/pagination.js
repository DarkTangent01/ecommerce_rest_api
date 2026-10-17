const ALLOWED_SORT_DIRECTIONS = new Set(["asc", "desc", "1", "-1"]);

export const buildPagination = (query, defaults = {}) => {
  const maxLimit = defaults.maxLimit || 100;
  const page = Math.max(Number.parseInt(query.page, 10) || 1, 1);
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || defaults.limit || 20, 1), maxLimit);
  const skip = (page - 1) * limit;

  return { page, limit, skip };
};

export const buildSort = (sortBy, order, allowedFields, fallback = "-createdAt") => {
  if (!sortBy || !allowedFields.includes(sortBy)) {
    return fallback;
  }

  const safeOrder = ALLOWED_SORT_DIRECTIONS.has(String(order).toLowerCase()) ? order : "asc";
  const prefix = String(safeOrder).toLowerCase() === "desc" || String(safeOrder) === "-1" ? "-" : "";
  return `${prefix}${sortBy}`;
};

export const buildCursorPagination = (query, defaults = {}) => {
  const limit = Math.min(Math.max(Number.parseInt(query.limit, 10) || defaults.limit || 20, 1), defaults.maxLimit || 100);
  const cursor = query.cursor ? new Date(query.cursor) : null;
  const filter = cursor && !Number.isNaN(cursor.getTime()) ? { createdAt: { $lt: cursor } } : {};
  return { limit, cursorFilter: filter };
};

export const nextCursorFrom = (items) => {
  if (!items.length) return null;
  const last = items[items.length - 1];
  return last.createdAt ? new Date(last.createdAt).toISOString() : null;
};
