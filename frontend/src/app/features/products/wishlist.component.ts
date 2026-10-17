import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartApiService, WishlistApiService } from '../../core/api/domain-api.services';
import { CartStateService } from '../../core/cart/cart-state.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ToastService } from '../../shared/components/toast.service';
import { Product } from '../../shared/models/api.models';

@Component({
  selector: 'app-wishlist',
  imports: [CurrencyPipe, RouterLink, EmptyStateComponent],
  template: `
    <section class="page-header">
      <p class="eyebrow">Saved</p>
      <h1>Wishlist</h1>
    </section>
    <div class="product-grid">
      @for (product of products(); track product._id) {
        <article class="product-card">
          <a [routerLink]="['/products', product._id]"><img [src]="product.image" [alt]="product.name" /></a>
          <div>
            <h3>{{ product.name }}</h3>
            <strong>{{ product.price | currency:'USD' }}</strong>
            <div class="shop-card-actions">
              <button class="button primary mini" type="button" (click)="moveToCart(product)">Move to cart</button>
              <button class="button ghost mini" type="button" (click)="remove(product._id)">Remove</button>
            </div>
          </div>
        </article>
      } @empty {
        <app-empty-state title="Wishlist is empty" description="Save products from the catalog for later." icon="0" />
      }
    </div>
  `,
})
export class WishlistComponent {
  private readonly api = inject(WishlistApiService);
  private readonly cartApi = inject(CartApiService);
  private readonly cartState = inject(CartStateService);
  private readonly toast = inject(ToastService);
  readonly products = signal<Product[]>([]);
  constructor() {
    this.load();
  }
  load(): void {
    this.api.get().subscribe((wishlist) => this.products.set(wishlist.products));
  }
  remove(productId: string): void {
    this.api.remove(productId).subscribe((wishlist) => {
      this.products.set(wishlist.products);
      this.toast.show('Removed from wishlist', 'success');
    });
  }

  moveToCart(product: Product): void {
    this.cartApi.add(product._id, 1).subscribe({
      next: (cart) => {
        this.cartState.set(cart);
        this.toast.show('Moved to cart', 'success');
      },
      error: (err) => this.toast.show(err.error?.message ?? 'Could not move item to cart', 'error'),
    });
  }
}
