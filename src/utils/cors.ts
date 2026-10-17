export const parseOriginList = (value: string) =>
  value
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

/**
 * Same-origin and non-browser requests (no Origin header) are always allowed. An empty allowlist
 * means "allow any origin" only outside production; in production it denies cross-origin browser
 * requests, because credentials are enabled and reflecting every origin would let any site call the API.
 */
export const isOriginAllowed = (origin: string | undefined, allowlist: readonly string[], nodeEnv: string): boolean => {
  if (!origin) return true;
  if (allowlist.length === 0) return nodeEnv !== "production";
  return allowlist.includes(origin);
};
