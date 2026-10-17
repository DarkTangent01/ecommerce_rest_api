import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { CanActivateFn, provideRouter, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { adminGuard, sellerGuard } from './role.guard';
import { authGuard } from './auth.guard';

const runGuard = (guard: CanActivateFn) => TestBed.runInInjectionContext(() => guard({} as never, {} as never));

describe('route guards', () => {
  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient()] });
  });

  it('redirects anonymous users from protected routes', () => {
    const result = runGuard(authGuard);
    expect(result instanceof UrlTree).toBe(true);
  });

  it('allows authenticated users', () => {
    sessionStorage.setItem('commerce_access_token', 'token');
    expect(runGuard(authGuard)).toBe(true);
  });

  it('allows only admins through the admin guard', () => {
    const auth = TestBed.inject(AuthService);
    auth.user.set({ _id: '1', name: 'Admin', email: 'a@example.com', role: 'admin' });
    expect(runGuard(adminGuard)).toBe(true);
  });

  it('allows seller and admin roles through the seller guard', () => {
    const auth = TestBed.inject(AuthService);
    auth.user.set({ _id: '2', name: 'Seller', email: 's@example.com', role: 'seller' });
    expect(runGuard(sellerGuard)).toBe(true);
    auth.user.set({ _id: '3', name: 'User', email: 'u@example.com', role: 'user' });
    expect(runGuard(sellerGuard) instanceof UrlTree).toBe(true);
  });
});
