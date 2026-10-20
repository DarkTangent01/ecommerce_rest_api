import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, CanActivateFn, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { adminGuard, sellerGuard } from './role.guard';
import { authGuard, guestGuard } from './auth.guard';
import { aUser, testProviders } from '../../../testing/test-helpers';
import type { Role } from '../models';

const run = (guard: CanActivateFn, url = '/orders') =>
  TestBed.runInInjectionContext(() => guard({} as ActivatedRouteSnapshot, { url } as RouterStateSnapshot));

const urlOf = (result: unknown) => TestBed.inject(Router).serializeUrl(result as UrlTree);

describe('route guards', () => {
  let auth: AuthService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ...testProviders()] });
    auth = TestBed.inject(AuthService);
    auth.status.set('anonymous');
  });

  const signInAs = (role: Role) => {
    auth.user.set(aUser({ role }));
    auth.status.set('authenticated');
  };

  it('authGuard sends anonymous users to login and remembers where they were going', () => {
    expect(urlOf(run(authGuard, '/orders/o1'))).toBe('/login?returnUrl=%2Forders%2Fo1');
    signInAs('user');
    expect(run(authGuard)).toBe(true);
  });

  it('guestGuard keeps signed-in users away from login/register', () => {
    expect(run(guestGuard)).toBe(true);
    signInAs('user');
    expect(urlOf(run(guestGuard))).toBe('/');
  });

  it('adminGuard admits admins only', () => {
    expect(urlOf(run(adminGuard))).toBe('/login');
    signInAs('user');
    expect(urlOf(run(adminGuard))).toBe('/unauthorized');
    signInAs('seller');
    expect(urlOf(run(adminGuard))).toBe('/unauthorized');
    signInAs('admin');
    expect(run(adminGuard)).toBe(true);
  });

  it('sellerGuard admits sellers and admins', () => {
    signInAs('user');
    expect(urlOf(run(sellerGuard))).toBe('/unauthorized');
    signInAs('seller');
    expect(run(sellerGuard)).toBe(true);
    signInAs('admin');
    expect(run(sellerGuard)).toBe(true);
  });
});
