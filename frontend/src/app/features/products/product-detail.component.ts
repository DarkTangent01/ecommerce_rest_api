import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { RouterLink } from '@angular/router';
import { ProductsApi } from '../../core/api/products.api';
import { ReviewsApi } from '../../core/api/catalog-extras.api';
import { AuthService } from '../../core/auth/auth.service';
import { CartActions } from '../../core/cart/cart-actions.service';
import { RULES } from '../../core/config/validation';
import { ApiError } from '../../core/http/api-error';
import type { ProductVariant, Review } from '../../core/models';
import { AppTitleStrategy } from '../../core/routing/title.strategy';
import { WishlistStore } from '../../core/wishlist/wishlist.store';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { RatingStarsComponent } from '../../shared/components/rating-stars.component';
import { StockBadgeComponent } from '../../shared/components/stock-badge.component';
import { ToastService } from '../../shared/components/toast.service';
import { errorMessage } from '../../shared/forms/form-errors';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';

const REVIEWS_PAGE_SIZE = 5;

@Component({
  selector: 'app-product-detail',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    AsyncStateComponent,
    EmptyStateComponent,
    RatingStarsComponent,
    StockBadgeComponent,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.scss',
})
export class ProductDetailComponent {
  private readonly productsApi = inject(ProductsApi);
  private readonly reviewsApi = inject(ReviewsApi);
  private readonly cartActions = inject(CartActions);
  private readonly titles = inject(AppTitleStrategy);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(NonNullableFormBuilder);
  readonly auth = inject(AuthService);
  readonly wishlist = inject(WishlistStore);

  /** Route parameter, bound by withComponentInputBinding(). */
  readonly id = input.required<string>();

  readonly product = rxResource({ params: () => this.id(), stream: ({ params }) => this.productsApi.get(params) });
  readonly state = computed(() => viewStateOf(this.product));
  readonly error = computed(() => errorMessageOf(this.product));

  readonly reviewPage = signal(1);
  readonly reviews = rxResource({
    params: () => ({ id: this.id(), page: this.reviewPage() }),
    stream: ({ params }) => this.reviewsApi.list(params.id, { page: params.page, limit: REVIEWS_PAGE_SIZE }),
  });
  readonly reviewsState = computed(() => viewStateOf(this.reviews));
  readonly reviewsPageSize = REVIEWS_PAGE_SIZE;

  readonly quantity = signal(1);
  /** Quantity choices: 1..stock, capped at the cart's 10-per-click convenience (the API allows up to 999). */
  readonly quantityOptions = computed(() => {
    const stock = this.product.value()?.stock ?? 0;
    return Array.from({ length: Math.min(stock, 10) }, (_, i) => i + 1);
  });
  readonly adding = signal(false);

  readonly reviewForm = this.fb.group({
    rating: [5, [Validators.required, Validators.min(1), Validators.max(5)]],
    title: ['', Validators.maxLength(RULES.review.title)],
    comment: ['', Validators.maxLength(RULES.review.comment)],
  });
  readonly submittingReview = signal(false);
  readonly reviewError = signal<string | null>(null);
  readonly rules = RULES;
  readonly errorMessage = errorMessage;

  constructor() {
    effect(() => {
      const product = this.product.value();
      if (product) this.titles.setPageTitle(product.name);
    });
  }

  variantLabel(variant: ProductVariant): string {
    return [variant.size, variant.color].filter((part): part is string => Boolean(part)).join(' / ') || variant.sku || 'Variant';
  }

  reviewerName(review: Review): string {
    return typeof review.user === 'object' ? review.user.name : 'Verified buyer';
  }

  addToCart(): void {
    const product = this.product.value();
    if (!product) return;
    this.adding.set(true);
    this.cartActions.add(product._id, this.quantity()).subscribe({
      complete: () => this.adding.set(false),
    });
  }

  toggleWishlist(): void {
    const product = this.product.value();
    if (product) this.wishlist.toggle(product._id).subscribe();
  }

  changeReviewPage(event: PageEvent): void {
    this.reviewPage.set(event.pageIndex + 1);
  }

  submitReview(): void {
    const product = this.product.value();
    if (!product || this.reviewForm.invalid || this.submittingReview()) return;
    const { rating, title, comment } = this.reviewForm.getRawValue();
    this.submittingReview.set(true);
    this.reviewError.set(null);
    this.reviewsApi.create(product._id, { rating, ...(title.trim() && { title: title.trim() }), ...(comment.trim() && { comment: comment.trim() }) }).subscribe({
      next: () => {
        this.submittingReview.set(false);
        this.toast.show('Thanks! Your review is published.', 'success');
        this.reviewForm.reset({ rating: 5, title: '', comment: '' });
        this.reviewPage.set(1);
        this.reviews.reload();
        // The backend recalculates the product's rating after a review is saved.
        this.product.reload();
      },
      error: (error: unknown) => {
        this.submittingReview.set(false);
        const apiError = ApiError.from(error);
        this.reviewError.set(apiError.status === 403 ? 'Only customers who bought this product can review it.' : apiError.message);
      },
    });
  }
}
