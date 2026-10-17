import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from './auth.service';
import { TokenStorage } from './token-storage';
import { API, aUser, envelope, failure, testProviders } from '../../../testing/test-helpers';

describe('AuthService', () => {
  let auth: AuthService;
  let http: HttpTestingController;
  let tokens: TokenStorage;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), ...testProviders()] });
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(TokenStorage);
  });

  afterEach(() => http.verify());

  const signIn = () => {
    auth.login({ email: 'ada@example.com', password: 'Password123' }).subscribe();
    http.expectOne(`${API}/login`).flush(envelope({ access_token: 'a1', refresh_token: 'r1', step_up_required: false }));
    http.expectOne(`${API}/users`).flush(envelope(aUser()));
  };

  it('keeps the access token in memory and only the refresh token in sessionStorage', () => {
    signIn();
    expect(auth.status()).toBe('authenticated');
    expect(auth.user()?.email).toBe('ada@example.com');
    expect(tokens.accessToken).toBe('a1');
    expect(sessionStorage.getItem('shop.rt')).toBe('r1');
    expect(JSON.stringify(sessionStorage)).not.toContain('a1');
  });

  it('takes the role from the profile, not from the token', () => {
    auth.login({ email: 'ada@example.com', password: 'Password123' }).subscribe();
    http.expectOne(`${API}/login`).flush(envelope({ access_token: 'a1', refresh_token: 'r1', step_up_required: true }));
    http.expectOne(`${API}/users`).flush(envelope(aUser({ role: 'seller' })));
    expect(auth.role()).toBe('seller');
    expect(auth.hasRole('admin')).toBe(false);
    expect(auth.stepUpRequired()).toBe(true);
  });

  it('shares one refresh between concurrent callers (refresh tokens are single-use)', () => {
    signIn();
    const results: string[] = [];
    auth.refreshAccessToken().subscribe((token) => results.push(token));
    auth.refreshAccessToken().subscribe((token) => results.push(token));

    const refresh = http.expectOne(`${API}/refresh`);
    expect(refresh.request.body).toEqual({ refresh_token: 'r1' });
    refresh.flush(envelope({ access_token: 'a2', refresh_token: 'r2' }));

    expect(results).toEqual(['a2', 'a2']);
    expect(sessionStorage.getItem('shop.rt')).toBe('r2');
  });

  it('restores the session on startup from the stored refresh token', async () => {
    sessionStorage.setItem('shop.rt', 'r9');
    const done = auth.init();
    http.expectOne(`${API}/refresh`).flush(envelope({ access_token: 'a9', refresh_token: 'r10' }));
    await Promise.resolve();
    http.expectOne(`${API}/users`).flush(envelope(aUser()));
    await done;
    expect(auth.isAuthenticated()).toBe(true);
  });

  it('starts anonymous when the stored refresh token is rejected', async () => {
    sessionStorage.setItem('shop.rt', 'stale');
    const done = auth.init();
    http.expectOne(`${API}/refresh`).flush(failure('UNAUTHORIZED', 'Invalid refresh token'), { status: 401, statusText: 'Unauthorized' });
    await done;
    expect(auth.status()).toBe('anonymous');
    expect(sessionStorage.getItem('shop.rt')).toBeNull();
  });

  it('logs out locally and revokes the refresh token on the server', () => {
    signIn();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    auth.logout();
    const req = http.expectOne(`${API}/logout`);
    expect(req.request.body).toEqual({ refresh_token: 'r1' });
    req.flush(envelope(null));
    expect(auth.isAuthenticated()).toBe(false);
    expect(tokens.accessToken).toBeNull();
    expect(navigate).toHaveBeenCalledWith('/');
  });
});
