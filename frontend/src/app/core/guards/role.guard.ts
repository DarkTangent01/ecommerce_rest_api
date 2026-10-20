import { inject } from '@angular/core';
import { CanActivateFn, CanMatchFn, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import type { Role } from '../models';

/**
 * Role-based guard. This only keeps the UI out of pages the user cannot use; every protected
 * endpoint is authorized again by the backend, which is the real security boundary.
 */
export const roleGuard =
  (...roles: Role[]): CanActivateFn & CanMatchFn =>
  () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    if (!auth.isAuthenticated()) return router.createUrlTree(['/login']);
    return auth.hasRole(...roles) || router.createUrlTree(['/unauthorized']);
  };

export const adminGuard = roleGuard('admin');
export const sellerGuard = roleGuard('seller', 'admin');
