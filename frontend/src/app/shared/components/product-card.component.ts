import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import type { Product } from '../../core/models';
import { MoneyPipe } from '../pipes/money.pipe';
import { RatingStarsComponent } from './rating-stars.component';
import { StockBadgeComponent } from './stock-badge.component';

/** Catalogue tile. Shows only what the API returns: no invented discounts or list prices. */
@Component({
  selector: 'app-product-card',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatIconModule, MoneyPipe, RatingStarsComponent, StockBadgeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mat-card class="card" appearance="outlined">
      <a class="media" [routerLink]="['/products', product()._id]" tabindex="-1" aria-hidden="true">
        <img [src]="product().image" [alt]="''" loading="lazy" width="320" height="320" />
      </a>
      <mat-card-content class="body">
        @if (product().category) {
          <span class="category">{{ product().category }}</span>
        }
        <h3 class="name"><a [routerLink]="['/products', product()._id]">{{ product().name }}</a></h3>
        @if (product().ratingCount > 0) {
          <app-rating-stars [value]="product().ratingAverage" [count]="product().ratingCount" />
        }
        <div class="price-row">
          <strong class="price">{{ product().price | money }}</strong>
          <app-stock-badge [stock]="product().stock" />
        </div>
      </mat-card-content>
      <mat-card-actions class="actions">
        <button mat-flat-button type="button" [disabled]="product().stock <= 0" (click)="addToCart.emit(product())">
          <mat-icon>add_shopping_cart</mat-icon> Add
        </button>
        <button
          mat-icon-button
          type="button"
          (click)="toggleWishlist.emit(product())"
          [attr.aria-label]="(saved() ? 'Remove ' : 'Save ') + product().name + (saved() ? ' from' : ' to') + ' wishlist'"
          [attr.aria-pressed]="saved()"
        >
          <mat-icon>{{ saved() ? 'favorite' : 'favorite_border' }}</mat-icon>
        </button>
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .card {
      height: 100%;
      display: flex;
      flex-direction: column;
      overflow: hidden;
    }
    .media img {
      width: 100%;
      aspect-ratio: 1;
      object-fit: cover;
      background: var(--mat-sys-surface-container);
    }
    .body {
      display: grid;
      gap: 4px;
      padding-top: 12px;
      flex: 1;
    }
    .category {
      font: var(--mat-sys-label-small);
      text-transform: uppercase;
      color: var(--mat-sys-on-surface-variant);
    }
    .name a {
      color: var(--mat-sys-on-surface);
      text-decoration: none;
    }
    .name a:hover {
      text-decoration: underline;
    }
    .price-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      gap: 8px;
    }
    .price {
      font: var(--mat-sys-title-medium);
    }
    .actions {
      justify-content: space-between;
    }
  `,
})
export class ProductCardComponent {
  readonly product = input.required<Product>();
  readonly saved = input(false);
  readonly addToCart = output<Product>();
  readonly toggleWishlist = output<Product>();
}
