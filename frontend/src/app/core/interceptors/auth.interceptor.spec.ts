import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import { authInterceptor } from './auth.interceptor';
import { API, aUser, envelope, failure, testProviders } from '../../../testing/test-helpers';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let auth: AuthService;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), ...testProviders()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => http.verify());

  const signIn = () => {
    auth.login({ email: 'ada@example.com', password: 'x' }).subscribe();
    http.expectOne(`${API}/login`).flush(envelope({ access_token: 'old', refresh_token: 'r1', step_up_required: false }));
    http.expectOne(`${API}/users`).flush(envelope(aUser()));
  };

  it('adds tenant and bearer headers to API requests', () => {
    signIn();
    client.get(`${API}/cart`).subscribe();
    const req = http.expectOne(`${API}/cart`);
    expect(req.request.headers.get('X-Tenant-Id')).toBe('acme');
    expect(req.request.headers.get('Authorization')).toBe('Bearer old');
    req.flush(envelope({ items: [] }));
  });

  it('never sends the token to other origins', () => {
    signIn();
    client.get('https://cdn.example.com/x.json').subscribe();
    const req = http.expectOne('https://cdn.example.com/x.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    expect(req.request.headers.has('X-Tenant-Id')).toBe(false);
    req.flush({});
  });

  it('refreshes once for concurrent 401s and retries each request with the new token', () => {
    signIn();
    const done: string[] = [];
    client.get(`${API}/cart`).subscribe(() => done.push('cart'));
    client.get(`${API}/orders`).subscribe(() => done.push('orders'));

    for (const url of ['cart', 'orders']) {
      http.expectOne(`${API}/${url}`).flush(failure('UNAUTHORIZED', 'jwt expired'), { status: 401, statusText: 'Unauthorized' });
    }
    http.expectOne(`${API}/refresh`).flush(envelope({ access_token: 'new', refresh_token: 'r2' }));

    const retries = http.match((req) => req.headers.get('Authorization') === 'Bearer new');
    expect(retries.map((req) => req.request.url).sort()).toEqual([`${API}/cart`, `${API}/orders`]);
    retries.forEach((req) => req.flush(envelope({})));
    expect(done.sort()).toEqual(['cart', 'orders']);
  });

  it('ends the session when the refresh fails', () => {
    signIn();
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    let failed = false;
    client.get(`${API}/cart`).subscribe({ error: () => (failed = true) });

    http.expectOne(`${API}/cart`).flush(failure('UNAUTHORIZED', 'jwt expired'), { status: 401, statusText: 'Unauthorized' });
    http.expectOne(`${API}/refresh`).flush(failure('UNAUTHORIZED', 'Invalid refresh token'), { status: 401, statusText: 'Unauthorized' });

    expect(failed).toBe(true);
    expect(auth.isAuthenticated()).toBe(false);
    expect(navigate).toHaveBeenCalledWith(['/login'], expect.objectContaining({ queryParams: expect.objectContaining({ reason: 'expired' }) }));
  });

  it('does not try to refresh for anonymous visitors', () => {
    let status = 0;
    client.get(`${API}/cart`).subscribe({ error: (e: { status: number }) => (status = e.status) });
    http.expectOne(`${API}/cart`).flush(failure('UNAUTHORIZED', 'unAuthorized'), { status: 401, statusText: 'Unauthorized' });
    http.expectNone(`${API}/refresh`);
    expect(status).toBe(401);
  });
});
