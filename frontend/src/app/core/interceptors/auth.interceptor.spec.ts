import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { environment } from '../../../environments/environment';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([]), provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  afterEach(() => http.verify());

  it('adds tenant and bearer headers for API requests', () => {
    sessionStorage.setItem('commerce_access_token', 'access');
    client.get(`${environment.apiBaseUrl}/users`).subscribe();

    const req = http.expectOne(`${environment.apiBaseUrl}/users`);
    expect(req.request.headers.get('X-Tenant-Id')).toBe(environment.tenantId);
    expect(req.request.headers.get('Authorization')).toBe('Bearer access');
    req.flush({ success: true, message: 'User profile', data: {} });
  });
});
