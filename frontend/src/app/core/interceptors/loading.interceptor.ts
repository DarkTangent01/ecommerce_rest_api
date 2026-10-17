import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { finalize } from 'rxjs';
import { SKIP_LOADING } from '../http/http-context';
import { LoadingService } from '../loading/loading.service';

/** Drives the global progress bar for every request that is not marked as background. */
export const loadingInterceptor: HttpInterceptorFn = (req, next) => {
  if (req.context.get(SKIP_LOADING)) return next(req);
  const loading = inject(LoadingService);
  loading.start();
  return next(req).pipe(finalize(() => loading.stop()));
};
