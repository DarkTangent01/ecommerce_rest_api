import assert from "assert";
import { app } from "../server.js";

const server = app.listen(0);
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

const request = async (path, options = {}) => {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
};

try {
  let result = await request("/api/health");
  assert.strictEqual(result.response.status, 200);
  assert.strictEqual(result.body.success, true);

  result = await request("/api/v1/health");
  assert.strictEqual(result.response.status, 200);

  result = await request("/api/openapi.json");
  assert.strictEqual(result.response.status, 200);
  assert.strictEqual(result.body.openapi, "3.0.3");

  result = await request("/api/platform/security-headers");
  assert.strictEqual(result.response.status, 200);
  assert.strictEqual(result.body.success, true);
  assert.strictEqual(result.response.headers.has("x-request-id"), true);

  result = await request("/api/products?x=1&x=2");
  assert.strictEqual(result.response.status, 400);
  assert.strictEqual(result.body.success, false);

  result = await request("/api/users");
  assert.strictEqual(result.response.status, 401);

  result = await request("/api/login", {
    method: "POST",
    body: JSON.stringify({ email: "bad", password: "x" }),
  });
  assert.strictEqual(result.response.status, 422);
  assert.strictEqual(result.body.message, "Validation failed");

  result = await request("/api/payments/webhook", {
    method: "POST",
    headers: { "X-Webhook-Event-Id": "evt_test" },
    body: JSON.stringify({ orderId: "507f1f77bcf86cd799439011", type: "payment.succeeded" }),
  });
  assert.strictEqual(result.response.status, 401);

  console.log("Runtime route tests passed.");
} finally {
  await new Promise((resolve) => server.close(resolve));
}
