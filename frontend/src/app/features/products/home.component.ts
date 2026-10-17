import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartApiService, ProductApiService, WishlistApiService } from '../../core/api/domain-api.services';
import { Product } from '../../shared/models/api.models';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { ToastService } from '../../shared/components/toast.service';
import { CartStateService } from '../../core/cart/cart-state.service';

@Component({
  selector: 'app-home',
  imports: [RouterLink, EmptyStateComponent, ProductCardComponent],
  template: `
    <section class="store-hero">
      <div class="store-hero-copy">
        <p class="eyebrow">Big brand energy, real backend data</p>
        <h1>Upgrade your cart with fresh drops, daily deals, and fast checkout.</h1>
        <p>Search products, save favorites, checkout securely, and track every order from one responsive storefront.</p>
        <div class="hero-actions">
          <a class="button primary" routerLink="/products">Shop now</a>
          <a class="button ghost" routerLink="/products" [queryParams]="{ sortBy: 'price', order: 'asc' }">View deals</a>
        </div>
      </div>
      <div class="store-hero-card">
        <span class="deal-chip">Weekend Sale</span>
        <strong>Up to 35% off</strong>
        <p>Trending picks across fashion, electronics, home, beauty, and sports.</p>
        <a routerLink="/products">Explore collection</a>
      </div>
    </section>

    <section class="category-strip">
      @for (category of categories; track category.name) {
        <a class="category-tile" routerLink="/products" [queryParams]="{ category: category.name }">
          <span>{{ category.short }}</span>
          <strong>{{ category.name }}</strong>
          <small>{{ category.copy }}</small>
        </a>
      }
    </section>

    <section class="deal-grid">
      @for (deal of deals; track deal.title) {
        <a class="deal-card" routerLink="/products" [queryParams]="deal.query">
          <span>{{ deal.kicker }}</span>
          <strong>{{ deal.title }}</strong>
          <p>{{ deal.copy }}</p>
        </a>
      }
    </section>

    <section class="section">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Featured products</p>
          <h2>Handpicked from the live catalog</h2>
        </div>
        <a class="text-link" routerLink="/products">View all</a>
      </div>
      <div class="product-grid">
        @for (product of products(); track product._id) {
          <app-product-card [product]="product" (addToCart)="addToCart($event)" (save)="save($event)" />
        } @empty {
          <app-empty-state title="No products yet" description="Create products as an admin or seller and they will appear here." icon="+" />
        }
      </div>
    </section>

    <section class="section two-column-promo">
      <div>
        <p class="eyebrow">New arrivals</p>
        <h2>Fresh styles just landed</h2>
        <p>Sort by newest and discover the latest products your sellers have added.</p>
        <a class="button primary" routerLink="/products" [queryParams]="{ sortBy: 'createdAt', order: 'desc' }">See new arrivals</a>
      </div>
      <div>
        <p class="eyebrow">Best sellers</p>
        <h2>Customer favorites</h2>
        <p>Products with strong ratings and steady stock get surfaced for quick buying decisions.</p>
        <a class="button ghost" routerLink="/products" [queryParams]="{ sortBy: 'name', order: 'asc' }">Browse best sellers</a>
      </div>
    </section>

    <section class="trust-row">
      @for (badge of trustBadges; track badge.title) {
        <div>
          <strong>{{ badge.title }}</strong>
          <span>{{ badge.copy }}</span>
        </div>
      }
    </section>
  `,
})
export class HomeComponent {
  private readonly cartApi = inject(CartApiService);
  private readonly wishlistApi = inject(WishlistApiService);
  private readonly cartState = inject(CartStateService);
  private readonly toast = inject(ToastService);
  readonly products = signal<Product[]>([]);
  readonly categories = [
    { name: 'Fashion', short: '01', copy: 'Trending fits' },
    { name: 'Electronics', short: '02', copy: 'Smart upgrades' },
    { name: 'Home', short: '03', copy: 'Everyday comfort' },
    { name: 'Beauty', short: '04', copy: 'Self-care picks' },
    { name: 'Sports', short: '05', copy: 'Performance gear' },
  ];
  readonly deals = [
    { kicker: 'Deal of the day', title: 'Price drops under $50', copy: 'Filter budget-friendly picks instantly.', query: { maxPrice: 50 } },
    { kicker: 'Limited stock', title: 'Almost gone', copy: 'Shop before low-stock products sell out.', query: { sortBy: 'stock', order: 'asc' } },
    { kicker: 'Top rated', title: 'Loved by shoppers', copy: 'Find catalog items with the strongest ratings.', query: { sortBy: 'name' } },
  ];
  readonly trustBadges = [
    { title: 'Secure checkout', copy: 'JWT protected and idempotent order creation' },
    { title: 'Easy returns', copy: 'Refund requests supported for paid orders' },
    { title: 'Saved favorites', copy: 'Wishlist backed by the live API' },
    { title: 'Seller ready', copy: 'Role-aware seller operations included' },
  ];

  constructor() {
    inject(ProductApiService)
      .list({ limit: 8 })
      .subscribe({ next: (res) => this.products.set(res.data), error: () => this.products.set([]) });
  }

  addToCart(product: Product): void {
    this.cartApi.add(product._id, 1).subscribe({
      next: (cart) => {
        this.cartState.set(cart);
        this.toast.show('Added to cart', 'success');
      },
      error: (err) => this.toast.show(err.error?.message ?? 'Login to add products to cart', 'error'),
    });
  }

  save(product: Product): void {
    this.wishlistApi.add(product._id).subscribe({
      next: () => this.toast.show('Saved to wishlist', 'success'),
      error: (err) => this.toast.show(err.error?.message ?? 'Login to save products', 'error'),
    });
  }
}
