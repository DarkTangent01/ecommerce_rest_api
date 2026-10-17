import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  CartApiService,
  ProductApiService,
  WishlistApiService,
} from '../../core/api/domain-api.services';
import { CartStateService } from '../../core/cart/cart-state.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { SkeletonComponent } from '../../shared/components/skeleton.component';
import { ToastService } from '../../shared/components/toast.service';
import { PaginationMeta, Product } from '../../shared/models/api.models';

@Component({
  selector: 'app-product-list',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    EmptyStateComponent,
    SkeletonComponent,
    ProductCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="catalog-hero">
      <div>
        <p class="eyebrow">Shop the catalog</p>
        <h1>Find your next favorite product.</h1>
        <p>Use live backend search, categories, price filters, sorting, and pagination.</p>
      </div>
      <a class="button primary" routerLink="/">Back to offers</a>
    </section>

    <section class="catalog-layout">
      <aside class="filter-sidebar">
        <form [formGroup]="filters" (ngSubmit)="applyFilters()">
          <h2>Filters</h2>
          <label>Search <input formControlName="q" placeholder="Shoes, phone, decor" /></label>
          <label
            >Category
            <select formControlName="category">
              <option value="">All categories</option>
              @for (category of categories; track category) {
                <option [value]="category">{{ category }}</option>
              }
            </select>
          </label>
          <div class="filter-pair">
            <label
              >Min price <input formControlName="minPrice" type="number" placeholder="0"
            /></label>
            <label
              >Max price <input formControlName="maxPrice" type="number" placeholder="500"
            /></label>
          </div>
          <label
            >Rating
            <select formControlName="rating">
              <option value="">Any rating</option>
              <option value="4">4 stars and above</option>
              <option value="3">3 stars and above</option>
              <option value="2">2 stars and above</option>
            </select>
          </label>
          <button class="button primary wide" type="submit">Apply filters</button>
          <button class="button ghost wide" type="button" (click)="reset()">Clear all</button>
        </form>
      </aside>

      <div class="catalog-results">
        <div class="catalog-toolbar">
          <div>
            <strong>{{ meta()?.total || visibleProducts().length }} results</strong>
            <span>Page {{ meta()?.page || 1 }} of {{ meta()?.pages || 1 }}</span>
          </div>
          <label
            >Sort
            <select [value]="sort()" (change)="sort.set($any($event.target).value); applyFilters()">
              <option value="createdAt:desc">Newest</option>
              <option value="price:asc">Price: Low to High</option>
              <option value="price:desc">Price: High to Low</option>
              <option value="name:asc">Name</option>
              <option value="stock:asc">Low stock</option>
            </select>
          </label>
        </div>

        @if (loading()) {
          <app-skeleton [count]="8" />
        } @else {
          <div class="product-grid">
            @for (product of visibleProducts(); track product._id) {
              <app-product-card
                [product]="product"
                (addToCart)="addToCart($event)"
                (save)="wishlist($event._id)"
              />
            } @empty {
              <app-empty-state
                title="No matching products"
                description="Try adjusting search, category, rating, or price filters."
                icon="0"
              />
            }
          </div>
          @if (meta()) {
            <div class="pagination">
              <button
                class="button ghost"
                [disabled]="page() <= 1"
                (click)="page.set(page() - 1); load()"
              >
                Previous
              </button>
              <span>Page {{ meta()?.page }} of {{ meta()?.pages || 1 }}</span>
              <button
                class="button ghost"
                [disabled]="page() >= (meta()?.pages || 1)"
                (click)="page.set(page() + 1); load()"
              >
                Next
              </button>
            </div>
          }
        }
      </div>
    </section>
  `,
})
export class ProductListComponent {
  private readonly api = inject(ProductApiService);
  private readonly cartApi = inject(CartApiService);
  private readonly wishlistApi = inject(WishlistApiService);
  private readonly cartState = inject(CartStateService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  readonly products = signal<Product[]>([]);
  readonly visibleProducts = signal<Product[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  readonly loading = signal(false);
  readonly page = signal(1);
  readonly sort = signal('createdAt:desc');
  readonly categories = ['Fashion', 'Electronics', 'Home', 'Beauty', 'Sports'];
  readonly filters = this.fb.nonNullable.group({
    q: '',
    category: '',
    minPrice: '',
    maxPrice: '',
    rating: '',
  });

  constructor() {
    this.route.queryParams.subscribe((params) => {
      this.filters.patchValue({
        q: params['q'] ?? '',
        category: params['category'] ?? '',
        minPrice: params['minPrice'] ?? '',
        maxPrice: params['maxPrice'] ?? '',
      });
      this.page.set(Number(params['page']) || 1);
      if (params['sortBy']) {
        this.sort.set(`${params['sortBy']}:${params['order'] ?? 'desc'}`);
      }
      this.load();
    });
  }

  applyFilters(): void {
    this.page.set(1);
    const [sortBy, order] = this.sort().split(':');
    const value = this.filters.getRawValue();
    void this.router.navigate(['/products'], {
      queryParams: {
        q: value.q || null,
        category: value.category || null,
        minPrice: value.minPrice || null,
        maxPrice: value.maxPrice || null,
        sortBy,
        order,
        page: this.page(),
      },
    });
  }

  reset(): void {
    this.filters.reset({ q: '', category: '', minPrice: '', maxPrice: '', rating: '' });
    this.sort.set('createdAt:desc');
    this.applyFilters();
  }

  load(): void {
    this.loading.set(true);
    const [sortBy, order] = this.sort().split(':');
    const { rating, ...query } = this.filters.getRawValue();
    this.api.list({ ...query, page: this.page(), limit: 12, sortBy, order }).subscribe({
      next: (res) => {
        this.products.set(res.data);
        const minRating = Number(rating) || 0;
        this.visibleProducts.set(
          minRating
            ? res.data.filter((product) => (product.ratingAverage || 0) >= minRating)
            : res.data,
        );
        this.meta.set(res.meta as PaginationMeta);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  addToCart(product: Product): void {
    this.cartApi.add(product._id, 1).subscribe({
      next: (cart) => {
        this.cartState.set(cart);
        this.toast.show('Added to cart', 'success');
      },
      error: (err) =>
        this.toast.show(err.error?.message ?? 'Login to add products to cart', 'error'),
    });
  }

  wishlist(productId: string): void {
    this.wishlistApi.add(productId).subscribe({
      next: () => this.toast.show('Added to wishlist', 'success'),
      error: (err) =>
        this.toast.show(err.error?.message ?? 'Login required to save wishlist items', 'error'),
    });
  }
}
