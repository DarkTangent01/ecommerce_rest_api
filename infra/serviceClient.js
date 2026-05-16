import { JwtService } from "../services/index.js";
import { SERVICE_JWT_SECRET } from "../config/index.js";

export const createServiceToken = (service, scopes = []) =>
  JwtService.sign({ service, scopes, type: "service" }, "5m", SERVICE_JWT_SECRET);

export const callInternalService = async ({ service, url, method = "GET", body, scopes = [], correlationId }) => {
  const headers = {
    Authorization: `Bearer ${createServiceToken(service, scopes)}`,
    "Content-Type": "application/json",
    "X-Correlation-Id": correlationId || "",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  return {
    ok: response.ok,
    status: response.status,
    data: await response.json().catch(() => null),
  };
};
