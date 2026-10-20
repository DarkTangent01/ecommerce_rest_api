import { JwtService } from "../services/index.js";
import { SERVICE_JWT_SECRET } from "../config/index.js";

export interface ServiceTokenClaims {
  service: string;
  scopes: string[];
  type: "service";
  /** The one tenant this token may act in (I-7). */
  tenant: string;
}

export const createServiceToken = (service: string, scopes: string[] = [], tenant: string) =>
  JwtService.sign({ service, scopes, type: "service", tenant } satisfies ServiceTokenClaims, "5m", SERVICE_JWT_SECRET);

export const callInternalService = async ({
  service,
  url,
  method = "GET",
  body,
  scopes = [],
  tenant,
  correlationId,
}: {
  service: string;
  url: string;
  method?: string;
  body?: unknown;
  scopes?: string[];
  tenant: string;
  correlationId?: string;
}) => {
  const headers = {
    Authorization: `Bearer ${createServiceToken(service, scopes, tenant)}`,
    "Content-Type": "application/json",
    "X-Correlation-Id": correlationId || "",
  };

  const response = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const data: unknown = await response.json().catch(() => null);
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
};
