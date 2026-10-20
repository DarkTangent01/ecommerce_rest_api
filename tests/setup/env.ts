// Deterministic, non-placeholder configuration for the test process.
// Loaded by Vitest before any test file imports application code.
process.env.NODE_ENV ??= "test";
process.env.JWT_SECRET ??= "test-access-secret-test-access-secret-0001";
process.env.REFRESH_SECRET ??= "test-refresh-secret-test-refresh-secret-01";
process.env.WEBHOOK_SECRET ??= "test-webhook-secret-test-webhook-secret-01";
process.env.SERVICE_JWT_SECRET ??= "test-service-secret-test-service-secret-01";
process.env.SIGNED_URL_SECRET ??= "test-signed-url-secret-test-signed-url-01";
process.env.BCRYPT_ROUNDS ??= "4";
process.env.DEBUG_MODE ??= "false";
