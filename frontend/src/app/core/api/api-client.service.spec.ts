import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ApiClientService } from './api-client.service';
import { environment } from '../../../environments/environment';

describe('ApiClientService', () => {
  let api: ApiClientService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(ApiClientService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('unwraps backend response envelopes', () => {
    let result: unknown;
    api.get('/health').subscribe((data) => (result = data));

    const req = http.expectOne(`${environment.apiBaseUrl}/health`);
    req.flush({ success: true, message: 'OK', data: { status: 'ready' } });

    expect(result).toEqual({ status: 'ready' });
  });

  it('serializes query params without empty values', () => {
    api.getEnvelope('/products', { q: 'shirt', category: '', page: 2 }).subscribe();

    const req = http.expectOne((request) => request.url === `${environment.apiBaseUrl}/products`);
    expect(req.request.params.get('q')).toBe('shirt');
    expect(req.request.params.get('category')).toBeNull();
    expect(req.request.params.get('page')).toBe('2');
    req.flush({ success: true, message: 'Products fetched', data: [], meta: { page: 2, limit: 20, total: 0, pages: 0 } });
  });
});
