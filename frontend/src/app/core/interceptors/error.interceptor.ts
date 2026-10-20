import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';
import { ApiError } from '../http/api-error';
import { SKIP_ERROR_TOAST } from '../http/http-context';
import { ToastService } from '../../shared/components/toast.service';

/**
 * Normalizes every failure to ApiError and shows a friendly toast unless the caller handles the
 * error itself (forms with inline messages pass SKIP_ERROR_TOAST). 401s are left to the auth flow.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      const apiError = ApiError.from(error);
      if (!req.context.get(SKIP_ERROR_TOAST) && apiError.status !== 401) {
        toast.show(apiError.message, 'error');
      }
      return throwError(() => apiError);
    }),
  );
};
