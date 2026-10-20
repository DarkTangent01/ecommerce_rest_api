import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { Product } from '../../core/models';
import { MoneyPipe } from '../pipes/money.pipe';
import { RatingStarsComponent } from './rating-stars.component';

/** Stock at or below this shows an "Only N left" badge. */
export const LOW_STOCK = 5;

/**
 * Catalogue tile. Shows only what the API returns: there are no list prices or discounts in the
 * API, so none are shown. The tile is separate links plus buttons (never one big link), so the
 * cart and wishlist buttons cannot trigger navigation.
 */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, MatButtonModule, MatIconModule, MoneyPipe, RatingStarsComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card" [class.sold-out]="soldOut()">
      <div class="media">
        <a [routerLink]="['/products', product()._id]" tabindex="-1" aria-hidden="true">
          @if (imageFailed() || !product().image) {
            <span class="fallback"><mat-icon aria-hidden="true">image_not_supported</mat-icon></span>
          } @else {
            <img [src]="product().image" alt="" loading="lazy" decoding="async" width="320" height="320" (error)="imageFailed.set(true)" />
          }
        </a>
        @if (badge(); as badge) {
          <span class="badge" [class]="'badge ' + badge.tone">{{ badge.label }}</span>
        }
        <button
          class="wish"
          mat-icon-button
          type="button"
          (click)="toggleWishlist.emit(product())"
          [attr.aria-label]="(saved() ? 'Remove ' : 'Save ') + product().name + (saved() ? ' from' : ' to') + ' wishlist'"
          [attr.aria-pressed]="saved()"
        >
          <mat-icon>{{ saved() ? 'favorite' : 'favorite_border' }}</mat-icon>
        </button>
      </div>
      <div class="body">
        @if (product().category) {
          <span class="category">{{ product().category }}</span>
        }
        <h3 class="name"><a [routerLink]="['/products', product()._id]">{{ product().name }}</a></h3>
        @if (product().ratingCount > 0) {
          <app-rating-stars [value]="product().ratingAverage" [count]="product().ratingCount" />
        }
        <strong class="price">{{ product().price | money }}</strong>
      </div>
      <button
        class="add"
        mat-flat-button
        type="button"
        [disabled]="soldOut()"
        [attr.aria-label]="soldOut() ? product().name + ' is out of stock' : 'Add ' + product().name + ' to cart'"
        (click)="addToCart.emit(product())"
      >
        {{ soldOut() ? 'Out of stock' : 'Add to cart' }}
      </button>
    </article>
  `,
  styles: `
    :host {
      display: block;
      height: 100%;
    }
    .card {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--as-surface);
      border: 1px solid var(--as-border);
      border-radius: var(--as-radius-lg);
      overflow: hidden;
      transition:
        box-shadow var(--as-duration) var(--as-ease),
        border-color var(--as-duration) var(--as-ease);
    }
    .card:hover {
      border-color: var(--as-border-strong);
      box-shadow: var(--as-shadow-2);
    }
    .media {
      position: relative;
      background: var(--as-gray-50);
    }
    .media a {
      display: block;
    }
    .media img,
    .fallback {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
    }
    .fallback {
      display: grid;
      place-items: center;
      color: var(--as-gray-400);
    }
    .sold-out .media img {
      opacity: 0.6;
    }
    .badge {
      position: absolute;
      left: var(--as-space-2);
      top: var(--as-space-2);
      padding: 2px var(--as-space-2);
      border-radius: var(--as-radius-sm);
      font-size: var(--as-text-xs);
      font-weight: var(--as-weight-semibold);
    }
    .badge.low {
      background: var(--as-warning-50);
      color: var(--as-warning-700);
    }
    .badge.out {
      background: var(--as-gray-800);
      color: var(--as-white);
    }
    .wish {
      position: absolute;
      top: var(--as-space-1);
      right: var(--as-space-1);
      background: rgb(255 255 255 / 0.92);
      color: var(--as-text);
    }
    .wish[aria-pressed='true'] {
      color: var(--as-danger-700);
    }
    .body {
      display: grid;
      align-content: start;
      gap: var(--as-space-1);
      padding: var(--as-space-3) var(--as-space-3) var(--as-space-2);
      flex: 1;
    }
    .category {
      font-size: var(--as-text-xs);
      font-weight: var(--as-weight-medium);
      letter-spacing: 0.04em;
      text-transform: uppercase;
      color: var(--as-text-muted);
    }
    .name {
      font-family: var(--as-font-sans);
      font-size: var(--as-text-sm);
      font-weight: var(--as-weight-medium);
      line-height: 1.35;
    }
    .name a {
      color: var(--as-text);
      text-decoration: none;
      display: -webkit-box;
      -webkit-line-clamp: 2;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    .name a:hover {
      color: var(--as-brand-600);
      text-decoration: underline;
    }
    .price {
      font-size: var(--as-text-lg);
      font-weight: var(--as-weight-bold);
    }
    .add {
      margin: 0 var(--as-space-3) var(--as-space-3);
    }
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly saved = input(false);
  readonly addToCart = output<Product>();
  readonly toggleWishlist = output<Product>();

  readonly imageFailed = signal(false);
  readonly soldOut = computed(() => this.product().stock <= 0);
  readonly badge = computed<{ label: string; tone: 'low' | 'out' } | null>(() => {
    const { stock } = this.product();
    if (stock <= 0) return { label: 'Out of stock', tone: 'out' };
    if (stock <= LOW_STOCK) return { label: `Only ${stock} left`, tone: 'low' };
    return null;
  });
}
