const SKIP_KEYS = new Set([
  "password",
  "repeat_password",
  "access_token",
  "refresh_token",
  "token",
  "authorization",
  "signature",
]);

const sanitizeString = (value) => value.replace(/[<>]/g, "");

const sanitizeObject = (value, parentKey = "") => {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeObject(item, parentKey));
  }

  if (value && typeof value === "object") {
    for (const [key, childValue] of Object.entries(value)) {
      value[key] = sanitizeObject(childValue, key.toLowerCase());
    }
    return value;
  }

  if (typeof value === "string" && !SKIP_KEYS.has(parentKey)) {
    return sanitizeString(value);
  }

  return value;
};

const sanitizeInput = (req, res, next) => {
  if (req.body) sanitizeObject(req.body);
  if (req.query) sanitizeObject(req.query);
  if (req.params) sanitizeObject(req.params);
  next();
};

export default sanitizeInput;
