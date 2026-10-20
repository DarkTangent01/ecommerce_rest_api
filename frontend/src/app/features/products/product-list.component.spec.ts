import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { ProductListComponent } from './product-list.component';
import { API, aProduct, envelope, testProviders } from '../../../testing/test-helpers';

describe('ProductListComponent', () => {
  let fixture: ComponentFixture<ProductListComponent>;
  let http: HttpTestingController;
  let router: Router;

  const open = async (url: string) => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'products', component: ProductListComponent }]),
        provideHttpClient(),
        provideHttpClientTesting(),
        ...testProviders(),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    await router.navigateByUrl(url);
    fixture = TestBed.createComponent(ProductListComponent);
    // Render and start the resource's request; whenStable() would wait for it to be answered.
    fixture.detectChanges();
    TestBed.tick();
  };
  const answer = (items = [aProduct()]) => {
    for (const req of http.match((r) => r.url === `${API}/products`)) {
      req.flush(envelope(items, { page: 1, limit: 12, total: items.length, pages: 1, nextCursor: null }));
    }
  };

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const chips = () => [...el().querySelectorAll('.chip')].map((c) => c.textContent?.replace('close', '').trim());

  it('requests exactly what the URL says and shows the active filters as chips', async () => {
    await open('/products?q=mug&category=kitchen&minPrice=5&maxPrice=40');
    const req = http.expectOne((r) => r.url === `${API}/products`);
    expect(req.request.params.get('q')).toBe('mug');
    expect(req.request.params.get('category')).toBe('kitchen');
    expect(req.request.params.get('minPrice')).toBe('5');
    req.flush(envelope([aProduct()], { page: 1, limit: 12, total: 1, pages: 1, nextCursor: null }));
    await fixture.whenStable();

    expect(chips()).toEqual(['“mug”', 'Kitchen', 'From $5.00', 'Up to $40.00']);
    expect(el().querySelector('h1')?.textContent).toContain('Results for “mug”');
    expect(el().querySelector('.count')?.textContent).toContain('1 result');
  });

  it('removes a single filter, or all of them', async () => {
    await open('/products?category=kitchen&maxPrice=40');
    answer();
    await fixture.whenStable();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    el().querySelector<HTMLButtonElement>('button[aria-label="Remove filter Kitchen"]')!.click();
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: { category: null, page: null } }));

    el().querySelector<HTMLButtonElement>('.clear-all')!.click();
    expect(navigate).toHaveBeenLastCalledWith([], expect.objectContaining({ queryParams: {} }));
  });

  it('shows a skeleton while loading and an empty state with no results', async () => {
    await open('/products?q=nothing');
    expect(el().querySelector('app-product-skeleton')).not.toBeNull();
    answer([]);
    await fixture.whenStable();
    expect(el().textContent).toContain('No products match');
  });

  it('rejects a max price below the min price', async () => {
    await open('/products');
    answer();
    await fixture.whenStable();
    const navigate = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance.filters.patchValue({ minPrice: 50, maxPrice: 10 });
    fixture.componentInstance.applyFilters();
    expect(navigate).not.toHaveBeenCalled();
    expect(fixture.componentInstance.filters.errors).toEqual({ priceRange: true });
  });
});
