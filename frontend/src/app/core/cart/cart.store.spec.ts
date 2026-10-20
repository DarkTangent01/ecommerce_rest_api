import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { CartStore } from './cart.store';
import { AuthService } from '../auth/auth.service';
import { API, aCart, aProduct, aUser, envelope, testProviders } from '../../../testing/test-helpers';

describe('CartStore', () => {
  let store: CartStore;
  let auth: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([]), ...testProviders()] });
    store = TestBed.inject(CartStore);
    auth = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const signIn = () => {
    auth.user.set(aUser());
    auth.status.set('authenticated');
    TestBed.tick();
  };

  it('loads the cart when the user signs in and resets it when they sign out', () => {
    signIn();
    http.expectOne(`${API}/cart`).flush(envelope(aCart([{ product: aProduct(), quantity: 2 }])));
    expect(store.count()).toBe(2);

    auth.clearSession();
    TestBed.tick();
    expect(store.count()).toBe(0);
    expect(store.status()).toBe('idle');
  });

  it('sends only the product id and quantity, and adopts the cart the server returns', () => {
    signIn();
    http.expectOne(`${API}/cart`).flush(envelope({ items: [] }));

    store.add('p1', 3).subscribe();
    expect(store.isBusy('p1')).toBe(true);
    const req = http.expectOne(`${API}/cart/items`);
    expect(req.request.body).toEqual({ productId: 'p1', quantity: 3 });
    req.flush(envelope(aCart([{ product: aProduct(), quantity: 3 }])));

    expect(store.isBusy('p1')).toBe(false);
    expect(store.lines()[0]?.quantity).toBe(3);
  });

  it('estimates the subtotal in cents (display only)', () => {
    signIn();
    http.expectOne(`${API}/cart`).flush(envelope(aCart([{ product: aProduct({ price: 0.1 }), quantity: 3 }])));
    expect(store.estimatedSubtotal()).toBe(0.3);
  });

  it('separates lines whose product no longer exists', () => {
    signIn();
    http.expectOne(`${API}/cart`).flush(envelope({ items: [{ product: null, quantity: 1 }, ...aCart([{ product: aProduct(), quantity: 1 }]).items] }));
    expect(store.lines()).toHaveLength(1);
    expect(store.unavailableLines()).toHaveLength(1);
  });
});
