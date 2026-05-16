import { CustomeErrorHandler } from "../services/index.js";

const privateHostPatterns = [
  /^localhost$/i,
  /^127\./,
  /^10\./,
  /^172\.(1[6-9]|2\d|3[0-1])\./,
  /^192\.168\./,
  /^169\.254\./,
  /^0\.0\.0\.0$/,
  /^\[?::1\]?$/,
];

export const assertSafeExternalUrl = (value) => {
  if (!value) return;
  let parsed;
  try {
    parsed = new URL(value);
  } catch (err) {
    throw CustomeErrorHandler.badRequest("Invalid URL");
  }

  if (!["https:"].includes(parsed.protocol)) {
    throw CustomeErrorHandler.badRequest("Only HTTPS URLs are allowed");
  }

  const hostname = parsed.hostname;
  if (privateHostPatterns.some((pattern) => pattern.test(hostname))) {
    throw CustomeErrorHandler.badRequest("Private network URLs are not allowed");
  }
};
