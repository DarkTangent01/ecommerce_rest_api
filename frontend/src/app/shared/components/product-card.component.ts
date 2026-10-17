import { CurrencyPipe } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Product } from '../models/api.models';
import { RatingStarsComponent } from './rating-stars.component';

@Component({
  selector: 'app-product-card',
  imports: [CurrencyPipe, RouterLink, RatingStarsComponent],
  template: `
    <article class="shop-card">
      <a class="shop-card-media" [routerLink]="['/products', product()._id]">
        <img [src]="product().image" [alt]="product().name" />
        <span class="product-badge" [class.out]="product().stock <= 0">{{ badge() }}</span>
      </a>
      <div class="shop-card-body">
        <p class="shop-card-category">{{ product().category || 'Essentials' }}</p>
        <h3><a [routerLink]="['/products', product()._id]">{{ product().name }}</a></h3>
        <app-rating-stars [value]="product().ratingAverage || 0" [count]="product().ratingCount || 0" />
        <div class="shop-price-row">
          <div>
            <strong>{{ product().price | currency: 'USD' }}</strong>
            <small>{{ listPrice() | currency: 'USD' }}</small>
          </div>
          <span>{{ discount() }}% off</span>
        </div>
        <div class="shop-card-actions">
          <button class="button primary mini" type="button" [disabled]="product().stock <= 0" (click)="addToCart.emit(product())">Add</button>
          <button class="icon-button subtle" type="button" aria-label="Save product" (click)="save.emit(product())">♡</button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCardComponent {
  product = input.required<Product>();
  addToCart = output<Product>();
  save = output<Product>();

  discount(): number {
    return this.product().stock <= 0 ? 0 : 12 + (this.product().name.length % 18);
  }

  listPrice(): number {
    return Math.round(this.product().price / (1 - this.discount() / 100));
  }

  badge(): string {
    if (this.product().stock <= 0) return 'OUT OF STOCK';
    if ((this.product().ratingAverage || 0) >= 4.5) return 'BESTSELLER';
    return this.product().createdAt ? 'NEW' : 'SALE';
  }
}
