import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { CartApiService, OrderApiService } from '../../core/api/domain-api.services';
import { CartStateService } from '../../core/cart/cart-state.service';
import { ToastService } from '../../shared/components/toast.service';
import { Cart, Product } from '../../shared/models/api.models';

@Component({
  selector: 'app-checkout',
  imports: [CurrencyPipe, ReactiveFormsModule],
  template: `
    <section class="checkout-page">
      <div class="checkout-main">
        <section class="checkout-step">
          <span>1</span>
          <div>
            <p class="eyebrow">Delivery address</p>
            <h1>Where should we ship it?</h1>
          </div>
        </section>

        <form class="checkout-form" [formGroup]="form" (ngSubmit)="submit()">
          <div class="form-grid two">
            <label>Address line 1 <input formControlName="line1" /></label>
            <label>Address line 2 <input formControlName="line2" /></label>
            <label>City <input formControlName="city" /></label>
            <label>State <input formControlName="state" /></label>
            <label>Postal code <input formControlName="postalCode" /></label>
            <label>Country <input formControlName="country" /></label>
          </div>

          <section class="checkout-step compact">
            <span>2</span>
            <div>
              <p class="eyebrow">Offers</p>
              <h2>Apply coupon</h2>
            </div>
          </section>
          <label>Coupon code <input formControlName="couponCode" placeholder="WELCOME10" /></label>

          <section class="checkout-step compact">
            <span>3</span>
            <div>
              <p class="eyebrow">Payment</p>
              <h2>Select payment method</h2>
            </div>
          </section>
          <div class="payment-methods">
            <label class="payment-option">
              <input type="radio" formControlName="paymentProvider" value="manual" />
              <strong>Manual payment</strong>
              <small>Creates an unpaid order; provider webhook updates payment status.</small>
            </label>
            <label class="payment-option">
              <input type="radio" formControlName="paymentProvider" value="razorpay" />
              <strong>Razorpay reference</strong>
              <small>Use when your payment provider integration calls the webhook.</small>
            </label>
          </div>

          <button class="button primary wide" [disabled]="form.invalid || loading()" type="submit">
            {{ loading() ? 'Placing order...' : 'Place order securely' }}
          </button>
        </form>
      </div>

      <aside class="summary-panel order-summary">
        <h2>Order summary</h2>
        @for (item of cart().items; track productOf(item.product)._id) {
          <div class="mini-line">
            <span>{{ productOf(item.product).name }} x {{ item.quantity }}</span>
            <strong>{{ productOf(item.product).price * item.quantity | currency: 'USD' }}</strong>
          </div>
        }
        <div class="summary-line"><span>Subtotal</span><strong>{{ total() | currency: 'USD' }}</strong></div>
        <div class="summary-line"><span>Delivery</span><strong>Free</strong></div>
        <div class="summary-total"><span>Payable now</span><strong>{{ total() | currency: 'USD' }}</strong></div>
        <p class="muted">Checkout sends a client-generated idempotency key required by the backend.</p>
      </aside>
    </section>
  `,
})
export class CheckoutComponent {
  private readonly fb = inject(FormBuilder);
  private readonly orders = inject(OrderApiService);
  private readonly cartApi = inject(CartApiService);
  private readonly cartState = inject(CartStateService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly cart = signal<Cart>({ items: [] });
  readonly loading = signal(false);
  readonly form = this.fb.nonNullable.group({
    line1: ['', Validators.required],
    line2: '',
    city: ['', Validators.required],
    state: ['', Validators.required],
    postalCode: ['', Validators.required],
    country: ['', Validators.required],
    couponCode: '',
    paymentProvider: 'manual',
  });

  constructor() {
    this.form.patchValue({ couponCode: this.route.snapshot.queryParamMap.get('couponCode') ?? '' });
    this.cartApi.get().subscribe((cart) => {
      this.cart.set(cart);
      this.cartState.set(cart);
    });
  }

  productOf(product: Product | string): Product {
    return this.cartState.productOf(product);
  }

  total(): number {
    return this.cart().items.reduce((sum, item) => {
      const product = this.productOf(item.product);
      return sum + (product.price || 0) * item.quantity;
    }, 0);
  }

  submit(): void {
    if (this.form.invalid) return;
    const value = this.form.getRawValue();
    this.loading.set(true);
    this.orders
      .checkout({
        shippingAddress: {
          line1: value.line1,
          line2: value.line2,
          city: value.city,
          state: value.state,
          postalCode: value.postalCode,
          country: value.country,
        },
        paymentProvider: value.paymentProvider,
        couponCode: value.couponCode,
      })
      .subscribe({
        next: (order) => {
          this.cartState.load();
          this.toast.show('Order placed successfully', 'success');
          void this.router.navigate(['/payments', order._id]);
        },
        error: (err) => {
          this.loading.set(false);
          this.toast.show(err.error?.message ?? 'Checkout failed', 'error');
        },
      });
  }
}
