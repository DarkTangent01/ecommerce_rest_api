import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiClientService } from './api-client.service';
import { API, envelope, testProviders } from '../../../testing/test-helpers';

describe('ApiClientService', () => {
  let api: ApiClientService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), ...testProviders()] });
    api = TestBed.inject(ApiClientService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps the data field of the envelope', () => {
    let result: unknown;
    api.get<{ status: string }>('/health').subscribe((data) => (result = data));
    http.expectOne(`${API}/health`).flush(envelope({ status: 'ready' }));
    expect(result).toEqual({ status: 'ready' });
  });

  it('returns items and meta for paginated lists', () => {
    let result: unknown;
    api.getPage('/orders', { page: 2 }).subscribe((page) => (result = page));
    http.expectOne(`${API}/orders?page=2`).flush(envelope([{ _id: 'o1' }], { page: 2, limit: 20, total: 21, pages: 2 }));
    expect(result).toEqual({ items: [{ _id: 'o1' }], meta: { page: 2, limit: 20, total: 21, pages: 2 } });
  });

  it('omits empty query parameters', () => {
    api.get('/products', { q: 'mug', category: '', minPrice: undefined, page: 1 }).subscribe();
    const req = http.expectOne((request) => request.url === `${API}/products`);
    expect(req.request.params.keys()).toEqual(['q', 'page']);
    req.flush(envelope([]));
  });

  it('recognises only its own API URLs', () => {
    expect(api.isApiUrl(`${API}/cart`)).toBe(true);
    expect(api.isApiUrl('https://fonts.googleapis.com/css2')).toBe(false);
    expect(api.isApiUrl('/api/v10/evil')).toBe(false);
  });
});
