import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CartComponent } from './cart.component';
import { API, aCart, aProduct, aUser, envelope, testProviders } from '../../../testing/test-helpers';

describe('CartComponent', () => {
  let fixture: ComponentFixture<CartComponent>;
  let http: HttpTestingController;

  const mug = aProduct({ _id: 'p1', name: 'Ceramic Mug', price: 12.5, stock: 3 });
  const lamp = aProduct({ _id: 'p2', name: 'Desk Lamp', price: 0.1, stock: 10 });

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CartComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ...testProviders()],
    });
    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    auth.user.set(aUser());
    auth.status.set('authenticated');

    fixture = TestBed.createComponent(CartComponent);
    // The store loads on sign-in and the page reloads on entry; answer both.
    for (const req of http.match(`${API}/cart`)) req.flush(envelope(aCart([{ product: mug, quantity: 2 }, { product: lamp, quantity: 3 }])));
    await fixture.whenStable();
    for (const req of http.match(`${API}/cart`)) req.flush(envelope(aCart([{ product: mug, quantity: 2 }, { product: lamp, quantity: 3 }])));
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const button = (label: string) => el().querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)!;

  it('lists lines and shows an estimated subtotal computed in cents', () => {
    expect(el().textContent).toContain('Ceramic Mug');
    expect(el().textContent).toContain('Desk Lamp');
    expect(el().textContent).toContain('Estimated subtotal');
    expect(el().textContent).toContain('$25.30');
    expect(el().textContent).toContain('final total is calculated by our servers');
  });

  it('sends only the product id and new quantity, and renders the server response', async () => {
    button('Increase quantity of Ceramic Mug').click();
    const req = http.expectOne(`${API}/cart/items`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual({ productId: 'p1', quantity: 3 });
    req.flush(envelope(aCart([{ product: mug, quantity: 3 }, { product: lamp, quantity: 3 }])));
    await fixture.whenStable();

    expect(button('Increase quantity of Ceramic Mug').disabled).toBe(true);
  });

  it('removes a line', async () => {
    button('Remove Desk Lamp from cart').click();
    const req = http.expectOne(`${API}/cart/items/p2`);
    expect(req.request.method).toBe('DELETE');
    req.flush(envelope(aCart([{ product: mug, quantity: 2 }])));
    await fixture.whenStable();
    expect(el().textContent).not.toContain('Desk Lamp');
  });

  it('blocks checkout while an item is unavailable', async () => {
    fixture.componentInstance.cart.cart.set(aCart([{ product: aProduct({ _id: 'p3', name: 'Old Thing', isActive: false }), quantity: 1 }]));
    await fixture.whenStable();
    expect(el().textContent).toContain('Some items are no longer available.');
    expect(el().querySelector('a.checkout')?.getAttribute('aria-disabled')).toBe('true');
  });
});
