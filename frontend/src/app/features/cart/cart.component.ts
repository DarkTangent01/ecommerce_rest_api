import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { CartApiService } from '../../core/api/domain-api.services';
import { CartStateService } from '../../core/cart/cart-state.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ToastService } from '../../shared/components/toast.service';
import { Product } from '../../shared/models/api.models';

@Component({
  selector: 'app-cart',
  imports: [CurrencyPipe, RouterLink, EmptyStateComponent, FormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page-header cart-header">
      <div>
        <p class="eyebrow">Shopping bag</p>
        <h1>Your cart</h1>
        <p>{{ cart.count() }} item{{ cart.count() === 1 ? '' : 's' }} ready for checkout.</p>
      </div>
      <a class="button ghost" routerLink="/products">Continue shopping</a>
    </section>

    @if (cart.cart().items.length) {
      <section class="cart-layout">
        <div class="stack">
          @for (item of cart.cart().items; track productOf(item.product)._id) {
            <article class="cart-item-card">
              <img [src]="productOf(item.product).image" [alt]="productOf(item.product).name" />
              <div class="cart-item-main">
                <span class="product-badge">{{
                  productOf(item.product).stock > 0 ? 'IN STOCK' : 'OUT OF STOCK'
                }}</span>
                <h3>{{ productOf(item.product).name }}</h3>
                <p>{{ productOf(item.product).category || 'General' }}</p>
                <strong>{{ productOf(item.product).price | currency: 'USD' }}</strong>
              </div>
              <div class="cart-item-actions">
                <div class="qty-control">
                  <button
                    type="button"
                    (click)="setQty(productOf(item.product)._id, item.quantity - 1)"
                  >
                    -
                  </button>
                  <span>{{ item.quantity }}</span>
                  <button
                    type="button"
                    (click)="setQty(productOf(item.product)._id, item.quantity + 1)"
                  >
                    +
                  </button>
                </div>
                <button
                  class="text-button"
                  type="button"
                  (click)="remove(productOf(item.product)._id)"
                >
                  Remove
                </button>
              </div>
            </article>
          }
        </div>

        <aside class="summary-panel checkout-summary">
          <h2>Price details</h2>
          <label
            >Coupon code
            <div class="coupon-row">
              <input [(ngModel)]="couponCode" placeholder="WELCOME10" />
              <button class="button ghost" type="button" (click)="applyCoupon()">Apply</button>
            </div>
          </label>
          <div class="summary-line">
            <span>Subtotal</span><strong>{{ cart.subtotal() | currency: 'USD' }}</strong>
          </div>
          <div class="summary-line">
            <span>Estimated discount</span><strong>-{{ discount() | currency: 'USD' }}</strong>
          </div>
          <div class="summary-line"><span>Delivery</span><strong>Free</strong></div>
          <div class="summary-total">
            <span>Total</span><strong>{{ total() | currency: 'USD' }}</strong>
          </div>
          <a
            class="button primary wide"
            [queryParams]="{ couponCode: couponCode || null }"
            routerLink="/checkout"
            >Proceed to checkout</a
          >
          <button class="button ghost wide" type="button" (click)="clear()">Clear cart</button>
        </aside>
      </section>
    } @else {
      <app-empty-state
        title="Your cart is empty"
        description="Add products from the catalog to start checkout."
        icon="0"
      />
    }
  `,
})
export class CartComponent {
  private readonly api = inject(CartApiService);
  readonly cart = inject(CartStateService);
  private readonly toast = inject(ToastService);
  couponCode = '';
  readonly discount = computed(() =>
    this.couponCode.trim() ? Math.min(this.cart.subtotal() * 0.1, 50) : 0,
  );
  readonly total = computed(() => Math.max(this.cart.subtotal() - this.discount(), 0));

  constructor() {
    this.cart.load();
  }

  productOf(product: Product | string): Product {
    return this.cart.productOf(product);
  }

  applyCoupon(): void {
    this.toast.show(
      this.couponCode ? 'Coupon will be validated during checkout' : 'Enter a coupon code',
      this.couponCode ? 'info' : 'error',
    );
  }

  setQty(productId: string, quantity: number): void {
    if (quantity < 1) return this.remove(productId);
    this.api.update(productId, quantity).subscribe((cart) => this.cart.set(cart));
  }

  remove(productId: string): void {
    this.api.remove(productId).subscribe((cart) => {
      this.cart.set(cart);
      this.toast.show('Item removed', 'success');
    });
  }

  clear(): void {
    this.api.clear().subscribe((cart) => this.cart.set(cart));
  }
}
