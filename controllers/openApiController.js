const errorModel = {
  type: "object",
  properties: {
    success: { type: "boolean", example: false },
    message: { type: "string", example: "Validation failed" },
    details: { type: "array", items: { type: "object" } },
  },
};

const successEnvelope = (schema) => ({
  type: "object",
  properties: {
    success: { type: "boolean", example: true },
    message: { type: "string" },
    data: schema,
    meta: { type: "object" },
  },
});

const spec = {
  openapi: "3.0.3",
  info: {
    title: "E-Commerce REST API",
    version: "3.0.0",
    description: "Microservices-ready modular monolith with zero-trust controls, domain events, sagas, and enterprise commerce modules.",
  },
  servers: [{ url: "/api/v1" }, { url: "/api" }],
  security: [{ bearerAuth: [] }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      apiKeyAuth: { type: "apiKey", in: "header", name: "X-API-Key" },
      serviceAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
    },
    schemas: {
      Error: errorModel,
      Product: {
        type: "object",
        properties: {
          _id: { type: "string" },
          name: { type: "string", example: "Classic T-Shirt" },
          price: { type: "number", example: 29.99 },
          stock: { type: "integer", example: 25 },
          variants: {
            type: "array",
            items: {
              type: "object",
              properties: {
                size: { type: "string", example: "M" },
                color: { type: "string", example: "Black" },
                sku: { type: "string", example: "TSHIRT-BLK-M" },
                price: { type: "number", example: 31.99 },
                stock: { type: "integer", example: 10 },
              },
            },
          },
        },
      },
      CheckoutRequest: {
        type: "object",
        required: ["shippingAddress"],
        properties: {
          couponCode: { type: "string", example: "WELCOME10" },
          shippingAddress: {
            type: "object",
            required: ["line1", "city", "state", "postalCode", "country"],
            properties: {
              line1: { type: "string", example: "221B Baker Street" },
              city: { type: "string", example: "London" },
              state: { type: "string", example: "London" },
              postalCode: { type: "string", example: "NW1" },
              country: { type: "string", example: "UK" },
            },
          },
        },
      },
    },
    responses: {
      Unauthorized: { description: "Unauthorized", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      Forbidden: { description: "Forbidden", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
      ValidationError: { description: "Validation error", content: { "application/json": { schema: { $ref: "#/components/schemas/Error" } } } },
    },
  },
  paths: {
    "/health": { get: { summary: "Health check", security: [] } },
    "/ready": { get: { summary: "Readiness check", security: [] } },
    "/openapi.json": { get: { summary: "OpenAPI document", security: [] } },
    "/register": { post: { summary: "Register user", security: [] } },
    "/login": { post: { summary: "Login user", security: [] } },
    "/products": {
      get: { summary: "List products with offset or cursor pagination", security: [] },
      post: { summary: "Create product", responses: { 403: { $ref: "#/components/responses/Forbidden" } } },
    },
    "/products/{id}": {
      get: { summary: "Get product", security: [], parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }] },
      put: { summary: "Update product" },
      delete: { summary: "Soft-delete product" },
    },
    "/orders/checkout": {
      post: {
        summary: "Create pending order, reserve inventory, and start order saga",
        parameters: [{ name: "Idempotency-Key", in: "header", required: true, schema: { type: "string" } }],
        requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/CheckoutRequest" } } } },
      },
    },
    "/payments/webhook": { post: { summary: "Signed payment webhook", security: [] } },
    "/platform/events": { get: { summary: "List domain events" } },
    "/platform/sagas": { get: { summary: "List saga instances" } },
    "/metrics": { get: { summary: "Metrics snapshot or Prometheus text" } },
    "/api-keys": { get: { summary: "List API keys" }, post: { summary: "Create scoped API key" } },
  },
};

const openApiController = {
  show(req, res) {
    res.json(spec);
  },
};

export default openApiController;
