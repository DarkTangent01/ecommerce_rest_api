import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';
import { AuthService } from '../auth/auth.service';
import { APP_SETTINGS } from '../config/app.config';
import { SKIP_AUTH } from '../http/http-context';

const withHeaders = (req: HttpRequest<unknown>, tenantId: string, token: string | null) =>
  req.clone({ setHeaders: { 'X-Tenant-Id': tenantId, ...(token && { Authorization: `Bearer ${token}` }) } });

/**
 * Adds the tenant and bearer token to API calls only (never to third-party URLs). On a 401 it
 * refreshes once (shared across concurrent requests) and retries; if that fails the session is over.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const api = inject(ApiClientService);
  if (!api.isApiUrl(req.url)) return next(req);

  const auth = inject(AuthService);
  const router = inject(Router);
  const { tenantId } = inject(APP_SETTINGS);
  const skipAuth = req.context.get(SKIP_AUTH);

  return next(withHeaders(req, tenantId, skipAuth ? null : auth.accessToken())).pipe(
    catchError((error: unknown) => {
      const canRefresh = !skipAuth && error instanceof HttpErrorResponse && error.status === 401 && auth.isAuthenticated();
      if (!canRefresh) return throwError(() => error);

      return auth.refreshAccessToken().pipe(
        catchError((refreshError: unknown) => {
          auth.sessionExpired(router.url);
          return throwError(() => refreshError);
        }),
        switchMap((token) => next(withHeaders(req, tenantId, token))),
      );
    }),
  );
};
