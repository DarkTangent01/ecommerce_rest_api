import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth/auth.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  const isRefresh = req.url.endsWith('/refresh');
  const isApi = req.url.startsWith(environment.apiBaseUrl);

  const headers: Record<string, string> = { 'X-Tenant-Id': environment.tenantId };
  if (token && isApi) headers['Authorization'] = `Bearer ${token}`;

  const request = isApi ? req.clone({ setHeaders: headers }) : req;

  return next(request).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401 || isRefresh || !auth.refreshToken()) {
        if (error.status === 401) auth.clearSession();
        return throwError(() => error);
      }

      return auth.refresh().pipe(
        switchMap((tokens) =>
          next(
            request.clone({
              setHeaders: {
                Authorization: `Bearer ${tokens.access_token}`,
                'X-Tenant-Id': environment.tenantId,
              },
            }),
          ),
        ),
        catchError((refreshError) => {
          auth.logout();
          return throwError(() => refreshError);
        }),
      );
    }),
  );
};
