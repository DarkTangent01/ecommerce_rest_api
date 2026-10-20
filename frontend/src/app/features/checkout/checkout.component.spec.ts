import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CheckoutComponent } from './checkout.component';
import { API, aCart, anOrder, aProduct, aUser, envelope, failure, testProviders } from '../../../testing/test-helpers';

describe('CheckoutComponent', () => {
  let fixture: ComponentFixture<CheckoutComponent>;
  let component: CheckoutComponent;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [CheckoutComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ...testProviders()],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    const auth = TestBed.inject(AuthService);
    auth.user.set(aUser());
    auth.status.set('authenticated');
    fixture = TestBed.createComponent(CheckoutComponent);
    component = fixture.componentInstance;
    const cart = envelope(aCart([{ product: aProduct(), quantity: 2 }]));
    for (const req of http.match(`${API}/cart`)) req.flush(cart);
    await fixture.whenStable();
    for (const req of http.match(`${API}/cart`)) req.flush(cart);
  });

  const fillAddress = () =>
    component.address.setValue({ line1: ' 1 Road ', line2: '', city: 'London', state: 'London', postalCode: 'NW1', country: 'UK' });

  it('does not submit an incomplete address', () => {
    component.placeOrder();
    http.expectNone(`${API}/orders/checkout`);
    expect(component.address.controls.line1.touched).toBe(true);
  });

  it('sends only the address and coupon (never prices) with an idempotency key, then shows the confirmation', () => {
    fillAddress();
    component.couponCode.setValue(' welcome10 ');
    component.placeOrder();

    const req = http.expectOne(`${API}/orders/checkout`);
    expect(req.request.body).toEqual({
      shippingAddress: { line1: '1 Road', city: 'London', state: 'London', postalCode: 'NW1', country: 'UK' },
      couponCode: 'WELCOME10',
    });
    expect(JSON.stringify(req.request.body)).not.toMatch(/price|total|discount/);
    expect(req.request.headers.get('Idempotency-Key')).toMatch(/^chk-/);
    req.flush(envelope(anOrder({ _id: 'o1' })));
    http.match(`${API}/cart`).forEach((r) => r.flush(envelope({ items: [] })));

    expect(navigate).toHaveBeenCalledWith(['/checkout/complete', 'o1']);
  });

  it('shows coupon errors on the coupon field', () => {
    fillAddress();
    component.couponCode.setValue('BOGUS');
    component.placeOrder();
    http.expectOne(`${API}/orders/checkout`).flush(failure('BAD_REQUEST', 'Invalid coupon'), { status: 400, statusText: 'Bad Request' });
    expect(component.couponCode.errors).toEqual({ server: 'Invalid coupon' });
    expect(component.placing()).toBe(false);
  });

  it('maps server field errors onto the address form', () => {
    fillAddress();
    component.placeOrder();
    http
      .expectOne(`${API}/orders/checkout`)
      .flush(failure('VALIDATION_FAILED', 'Validation failed', [{ field: 'shippingAddress.postalCode', message: 'is required' }]), {
        status: 422,
        statusText: 'Unprocessable',
      });
    expect(component.address.controls.postalCode.errors).toEqual({ server: 'is required' });
  });
});
