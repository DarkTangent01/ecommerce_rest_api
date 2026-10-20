import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { SearchBoxComponent, SUGGEST_DEBOUNCE_MS } from './search-box.component';
import { API, aProduct, envelope, testProviders } from '../../../testing/test-helpers';

describe('SearchBoxComponent', () => {
  let fixture: ComponentFixture<SearchBoxComponent>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      imports: [SearchBoxComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ...testProviders()],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    fixture = TestBed.createComponent(SearchBoxComponent);
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
  });

  const typeQuery = (value: string) => {
    fixture.componentInstance.query.setValue(value);
    vi.advanceTimersByTime(SUGGEST_DEBOUNCE_MS);
  };
  const suggestUrl = (req: { url: string }) => req.url === `${API}/products`;

  it('waits for two characters and the debounce before asking for suggestions', () => {
    typeQuery('m');
    http.expectNone(suggestUrl);

    fixture.componentInstance.query.setValue('mu');
    vi.advanceTimersByTime(SUGGEST_DEBOUNCE_MS - 1);
    http.expectNone(suggestUrl);
    vi.advanceTimersByTime(1);

    const req = http.expectOne(suggestUrl);
    expect(req.request.params.get('q')).toBe('mu');
    expect(req.request.params.get('limit')).toBe('6');
    req.flush(envelope([aProduct()]));
    expect(fixture.componentInstance.suggestions().map((p) => p.name)).toEqual(['Ceramic Mug']);
  });

  it('cancels an older lookup when the shopper keeps typing, so stale results never win', () => {
    typeQuery('mug');
    const first = http.expectOne(suggestUrl);
    typeQuery('mugs');
    expect(first.cancelled).toBe(true);
    http.expectOne(suggestUrl).flush(envelope([aProduct({ _id: 'p2', name: 'Mug set' })]));
    expect(fixture.componentInstance.suggestions().map((p) => p.name)).toEqual(['Mug set']);
  });

  it('scopes suggestions to the selected category', () => {
    fixture.componentInstance.scope.setValue('kitchen');
    typeQuery('mug');
    const req = http.expectOne(suggestUrl);
    expect(req.request.params.get('category')).toBe('kitchen');
    req.flush(envelope([]));
  });

  it('shows no suggestions when the lookup fails, instead of an error', () => {
    typeQuery('mug');
    http.expectOne(suggestUrl).flush(null, { status: 500, statusText: 'Server Error' });
    expect(fixture.componentInstance.suggestions()).toEqual([]);
  });

  it('submits to the results page with the query and category', () => {
    fixture.componentInstance.scope.setValue('outdoors');
    fixture.componentInstance.query.setValue('  lantern ', { emitEvent: false });
    fixture.componentInstance.submit();
    expect(navigate).toHaveBeenCalledWith(['/products'], { queryParams: { q: 'lantern', category: 'outdoors' } });
  });

  it('handles Enter in the app instead of letting the browser reload the page', () => {
    fixture.componentInstance.query.setValue('mug', { emitEvent: false });
    const event = new Event('submit', { cancelable: true });
    (fixture.nativeElement as HTMLElement).querySelector('form')!.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(navigate).toHaveBeenCalledWith(['/products'], { queryParams: { q: 'mug', category: null } });
  });

  it('opens the product when a suggestion is picked', () => {
    const product = aProduct({ _id: 'abc' });
    fixture.componentInstance.open({ option: { value: product } } as never);
    expect(navigate).toHaveBeenCalledWith(['/products', 'abc']);
  });
});
