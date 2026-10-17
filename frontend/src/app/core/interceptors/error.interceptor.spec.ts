import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { errorInterceptor } from './error.interceptor';
import { ApiError } from '../http/api-error';
import { contextFor } from '../http/http-context';
import { API, failure, testProviders, type ToastSpy } from '../../../testing/test-helpers';

describe('errorInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
  let toast: ToastSpy;

  beforeEach(() => {
    toast = { show: vi.fn() };
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), ...testProviders(toast)],
    });
    http = TestBed.inject(HttpTestingController);
    client = TestBed.inject(HttpClient);
  });

  it('rethrows an ApiError and shows a toast', () => {
    let error: unknown;
    client.get(`${API}/products/x`).subscribe({ error: (e: unknown) => (error = e) });
    http.expectOne(`${API}/products/x`).flush(failure('NOT_FOUND', 'Product not found'), { status: 404, statusText: 'Not Found' });
    expect(error).toBeInstanceOf(ApiError);
    expect(toast.show).toHaveBeenCalledWith('Product not found', 'error');
  });

  it('stays quiet when the caller handles the error', () => {
    client.post(`${API}/login`, {}, { context: contextFor({ skipErrorToast: true }) }).subscribe({ error: () => undefined });
    http.expectOne(`${API}/login`).flush(failure('VALIDATION_FAILED', 'Validation failed'), { status: 422, statusText: 'Unprocessable' });
    expect(toast.show).not.toHaveBeenCalled();
  });

  it('leaves 401s to the auth flow', () => {
    client.get(`${API}/cart`).subscribe({ error: () => undefined });
    http.expectOne(`${API}/cart`).flush(failure('UNAUTHORIZED', 'unAuthorized'), { status: 401, statusText: 'Unauthorized' });
    expect(toast.show).not.toHaveBeenCalled();
  });
});
