import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  CartApiService,
  ProductApiService,
  ReviewApiService,
  WishlistApiService,
} from '../../core/api/domain-api.services';
import { CartStateService } from '../../core/cart/cart-state.service';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { RatingStarsComponent } from '../../shared/components/rating-stars.component';
import { ToastService } from '../../shared/components/toast.service';
import { Product, Review } from '../../shared/models/api.models';

@Component({
  selector: 'app-product-detail',
  imports: [
    CurrencyPipe,
    ReactiveFormsModule,
    EmptyStateComponent,
    RatingStarsComponent,
    ProductCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (product(); as item) {
      <section class="product-detail">
        <div class="gallery">
          <div class="thumb-list">
            <button class="thumb active" type="button">
              <img [src]="item.image" [alt]="item.name" />
            </button>
            @for (variant of item.variants || []; track variant.sku) {
              <button class="thumb" type="button">
                {{ variant.color || variant.size || 'SKU' }}
              </button>
            }
          </div>
          <div class="main-image">
            <img [src]="item.image" [alt]="item.name" />
            <span class="product-badge" [class.out]="item.stock <= 0">{{ badge(item) }}</span>
          </div>
        </div>

        <div class="buy-box">
          <p class="shop-card-category">{{ item.category || 'Essentials' }}</p>
          <h1>{{ item.name }}</h1>
          <app-rating-stars [value]="item.ratingAverage || 0" [count]="item.ratingCount || 0" />
          <p class="detail-copy">
            {{
              item.description || 'A carefully selected catalog item ready for your ecommerce flow.'
            }}
          </p>

          <div class="detail-price">
            <strong>{{ item.price | currency: 'USD' }}</strong>
            <span>{{ listPrice(item) | currency: 'USD' }}</span>
            <em>{{ discount(item) }}% off</em>
          </div>

          <div class="stock-line" [class.out]="item.stock <= 0">
            {{ item.stock > 0 ? item.stock + ' in stock' : 'Out of stock' }}
          </div>

          <form [formGroup]="cartForm" class="purchase-panel">
            <label>Quantity <input type="number" min="1" formControlName="quantity" /></label>
            <div class="purchase-actions">
              <button
                class="button primary"
                type="button"
                [disabled]="item.stock <= 0"
                (click)="addToCart()"
              >
                Add to cart
              </button>
              <button
                class="button buy-now"
                type="button"
                [disabled]="item.stock <= 0"
                (click)="buyNow()"
              >
                Buy now
              </button>
              <button class="button ghost" type="button" (click)="save()">Wishlist</button>
            </div>
          </form>

          <div class="delivery-card">
            <strong>Delivery and buyer protection</strong>
            <span
              >Secure order creation, stock reservation, coupon support, and order tracking are
              handled by the backend.</span
            >
          </div>
        </div>
      </section>

      <section class="section split product-info-split">
        <article class="panel">
          <h2>Customer reviews</h2>
          <div class="review-list">
            @for (review of reviews(); track review._id) {
              <article class="review-card compact">
                <app-rating-stars [value]="review.rating" />
                <strong>{{ review.title || 'Verified review' }}</strong>
                <p>{{ review.comment || 'No comment added.' }}</p>
                <small>{{ review.user?.name || 'Verified customer' }}</small>
              </article>
            } @empty {
              <app-empty-state
                title="No reviews yet"
                description="Reviews require a verified purchase in the backend."
                icon="0"
              />
            }
          </div>
        </article>

        <form class="form-card" [formGroup]="reviewForm" (ngSubmit)="submitReview()">
          <h2>Add a review</h2>
          <label
            >Rating
            <select formControlName="rating">
              <option [value]="5">5 stars</option>
              <option [value]="4">4 stars</option>
              <option [value]="3">3 stars</option>
              <option [value]="2">2 stars</option>
              <option [value]="1">1 star</option>
            </select>
          </label>
          <label>Title <input formControlName="title" placeholder="Great quality" /></label>
          <label
            >Comment
            <textarea
              formControlName="comment"
              placeholder="Share your product experience"
            ></textarea>
          </label>
          <button class="button primary wide" type="submit" [disabled]="reviewForm.invalid">
            Submit review
          </button>
          <p class="muted">The API accepts reviews only from verified purchasers.</p>
        </form>
      </section>

      <section class="section">
        <div class="section-heading">
          <div>
            <p class="eyebrow">Related products</p>
            <h2>More picks from this category</h2>
          </div>
        </div>
        <div class="product-grid">
          @for (related of relatedProducts(); track related._id) {
            <app-product-card
              [product]="related"
              (addToCart)="addToCartProduct($event)"
              (save)="saveProduct($event)"
            />
          }
        </div>
      </section>
    }
  `,
})
export class ProductDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly productsApi = inject(ProductApiService);
  private readonly cartApi = inject(CartApiService);
  private readonly cartState = inject(CartStateService);
  private readonly wishlistApi = inject(WishlistApiService);
  private readonly reviewsApi = inject(ReviewApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly product = signal<Product | null>(null);
  readonly relatedProducts = signal<Product[]>([]);
  readonly reviews = signal<Review[]>([]);
  readonly cartForm = this.fb.nonNullable.group({
    quantity: [1, [Validators.required, Validators.min(1)]],
  });
  readonly reviewForm = this.fb.nonNullable.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    title: [''],
    comment: [''],
  });

  constructor() {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.productsApi.get(id).subscribe((product) => {
      this.product.set(product);
      this.productsApi
        .list({ category: product.category || '', limit: 4 })
        .subscribe({
          next: (res) => this.relatedProducts.set(res.data.filter((item) => item._id !== id)),
          error: () => undefined,
        });
    });
    this.reviewsApi
      .list(id)
      .subscribe({
        next: (reviews) => this.reviews.set(reviews),
        error: () => this.reviews.set([]),
      });
  }

  discount(product: Product): number {
    return product.stock <= 0 ? 0 : 15 + (product.name.length % 20);
  }

  listPrice(product: Product): number {
    return Math.round(product.price / (1 - this.discount(product) / 100));
  }

  badge(product: Product): string {
    if (product.stock <= 0) return 'OUT OF STOCK';
    if ((product.ratingAverage || 0) >= 4.5) return 'BESTSELLER';
    return 'SALE';
  }

  addToCart(): void {
    const item = this.product();
    if (!item || this.cartForm.invalid) return;
    this.addToCartProduct(item, this.cartForm.getRawValue().quantity);
  }

  buyNow(): void {
    const item = this.product();
    if (!item) return;
    this.addToCartProduct(
      item,
      this.cartForm.getRawValue().quantity,
      () => void this.router.navigateByUrl('/checkout'),
    );
  }

  addToCartProduct(product: Product, quantity = 1, after?: () => void): void {
    this.cartApi.add(product._id, quantity).subscribe({
      next: (cart) => {
        this.cartState.set(cart);
        this.toast.show('Added to cart', 'success');
        after?.();
      },
      error: (err) =>
        this.toast.show(err.error?.message ?? 'Login to add products to cart', 'error'),
    });
  }

  save(): void {
    const item = this.product();
    if (item) this.saveProduct(item);
  }

  saveProduct(product: Product): void {
    this.wishlistApi.add(product._id).subscribe({
      next: () => this.toast.show('Saved to wishlist', 'success'),
      error: (err) => this.toast.show(err.error?.message ?? 'Could not save item', 'error'),
    });
  }

  submitReview(): void {
    const item = this.product();
    if (!item || this.reviewForm.invalid) return;
    this.reviewsApi.create(item._id, this.reviewForm.getRawValue()).subscribe({
      next: (review) => {
        this.reviews.update((reviews) => [review, ...reviews]);
        this.reviewForm.reset({ rating: 5, title: '', comment: '' });
        this.toast.show('Review saved', 'success');
      },
      error: (err) =>
        this.toast.show(err.error?.message ?? 'Review requires a verified purchase', 'error'),
    });
  }
}
