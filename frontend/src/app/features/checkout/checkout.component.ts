import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators, type ValidatorFn } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatStepperModule } from '@angular/material/stepper';
import { Router, RouterLink } from '@angular/router';
import { OrdersApi } from '../../core/api/orders.api';
import { AuthService } from '../../core/auth/auth.service';
import { CartStore } from '../../core/cart/cart.store';
import { RULES } from '../../core/config/validation';
import { ApiError } from '../../core/http/api-error';
import type { CheckoutRequest } from '../../core/models';
import { AsyncStateComponent, type ViewState } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { applyServerErrors, errorMessage } from '../../shared/forms/form-errors';
import { notBlank } from '../../shared/forms/validators';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { CheckoutAttempt } from './idempotency';

const required = (max: number): [string, ValidatorFn[]] => ['', [Validators.required, notBlank, Validators.maxLength(max)]];

@Component({
  selector: 'app-checkout',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatStepperModule,
    AsyncStateComponent,
    EmptyStateComponent,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.scss',
})
export class CheckoutComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly orders = inject(OrdersApi);
  private readonly router = inject(Router);
  readonly cart = inject(CartStore);
  readonly auth = inject(AuthService);

  readonly rules = RULES;
  readonly errorMessage = errorMessage;
  private readonly attempt = new CheckoutAttempt();

  readonly address = this.fb.group({
    line1: required(RULES.address.line1),
    line2: ['', Validators.maxLength(RULES.address.line2)],
    city: required(RULES.address.city),
    state: required(RULES.address.state),
    postalCode: required(RULES.address.postalCode),
    country: required(RULES.address.country),
  });
  readonly couponCode = this.fb.control('', [Validators.maxLength(RULES.couponCode.max)]);

  readonly placing = signal(false);
  readonly orderError = signal<{ message: string; action?: 'cart' | 'signin' } | null>(null);

  readonly state = computed<ViewState>(() => {
    if (this.cart.status() === 'error') return 'error';
    return this.cart.status() === 'loading' && this.cart.cart().items.length === 0 ? 'loading' : 'ready';
  });
  readonly blocked = computed(() => this.cart.isEmpty() || this.cart.unavailableLines().length > 0);

  constructor() {
    this.cart.load();
  }

  placeOrder(): void {
    this.address.markAllAsTouched();
    if (this.address.invalid || this.couponCode.invalid || this.placing() || this.blocked()) return;

    const body = this.buildRequest();
    this.placing.set(true);
    this.orderError.set(null);

    this.orders.checkout(body, this.attempt.keyFor(body)).subscribe({
      next: (order) => {
        this.attempt.reset();
        this.cart.load(); // the server emptied the cart
        void this.router.navigate(['/checkout/complete', order._id]);
      },
      error: (error: unknown) => {
        const apiError = ApiError.from(error);
        this.attempt.failed(apiError);
        this.placing.set(false);
        this.handleError(apiError);
      },
    });
  }

  private buildRequest(): CheckoutRequest {
    const { line2, ...address } = this.address.getRawValue();
    const trimmed = Object.fromEntries(Object.entries(address).map(([key, value]) => [key, value.trim()])) as Omit<CheckoutRequest['shippingAddress'], 'line2'>;
    const coupon = this.couponCode.value.trim().toUpperCase();
    // Only identifiers, the address and the coupon code are sent; the server prices the order.
    return {
      shippingAddress: { ...trimmed, ...(line2.trim() && { line2: line2.trim() }) },
      ...(coupon && { couponCode: coupon }),
    };
  }

  private handleError(error: ApiError): void {
    if (error.status === 422) {
      const unmatched = applyServerErrors(this.address, error, {
        'shippingAddress.line1': 'line1',
        'shippingAddress.line2': 'line2',
        'shippingAddress.city': 'city',
        'shippingAddress.state': 'state',
        'shippingAddress.postalCode': 'postalCode',
        'shippingAddress.country': 'country',
      });
      this.orderError.set({ message: unmatched.length ? unmatched.join(' ') : 'Please check the highlighted fields.' });
      return;
    }
    if (error.status === 403 && /step-up/i.test(error.message)) {
      this.orderError.set({
        message: 'For your security we could not place this order from this session. Please sign out and sign in again, then retry.',
        action: 'signin',
      });
      return;
    }
    if (/coupon/i.test(error.message)) {
      this.couponCode.setErrors({ server: error.message });
      this.couponCode.markAsTouched();
      this.orderError.set({ message: error.message });
      return;
    }
    if (/out of stock|unavailable|cart is empty/i.test(error.message)) {
      this.orderError.set({ message: `${error.message}. Please review your cart.`, action: 'cart' });
      return;
    }
    this.orderError.set({ message: error.message });
  }
}
