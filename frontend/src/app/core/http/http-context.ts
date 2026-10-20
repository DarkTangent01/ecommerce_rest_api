import { HttpContext, HttpContextToken } from '@angular/common/http';

/** Do not attach the access token or attempt a refresh (login/register/refresh themselves). */
export const SKIP_AUTH = new HttpContextToken<boolean>(() => false);

/** The caller shows the error itself (e.g. inline form errors), so no global toast. */
export const SKIP_ERROR_TOAST = new HttpContextToken<boolean>(() => false);

/** Background request that should not drive the global progress bar. */
export const SKIP_LOADING = new HttpContextToken<boolean>(() => false);

export interface RequestFlags {
  skipAuth?: boolean;
  skipErrorToast?: boolean;
  skipLoading?: boolean;
}

export const contextFor = ({ skipAuth, skipErrorToast, skipLoading }: RequestFlags = {}): HttpContext => {
  const context = new HttpContext();
  if (skipAuth) context.set(SKIP_AUTH, true);
  if (skipErrorToast) context.set(SKIP_ERROR_TOAST, true);
  if (skipLoading) context.set(SKIP_LOADING, true);
  return context;
};
