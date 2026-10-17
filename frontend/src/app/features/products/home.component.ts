import { ChangeDetectionStrategy, Component, inject, signal, type WritableSignal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { ProductsApi } from '../../core/api/products.api';
import { CATEGORIES } from '../../core/config/catalog';
import { ApiError } from '../../core/http/api-error';
import type { Product, ProductQuery } from '../../core/models';
import { AsyncStateComponent, type ViewState } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { ProductGridPage } from './catalog-page.base';

interface Shelf {
  title: string;
  query: ProductQuery;
  link: Record<string, string | number>;
  state: WritableSignal<ViewState>;
  error: WritableSignal<string | null>;
  products: WritableSignal<Product[]>;
}

@Component({
  selector: 'app-home',
  imports: [RouterLink, MatButtonModule, MatIconModule, AsyncStateComponent, EmptyStateComponent, ProductCardComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent extends ProductGridPage {
  private readonly api = inject(ProductsApi);
  readonly categories = CATEGORIES;

  readonly shelves: Shelf[] = [
    this.shelf('New arrivals', { sortBy: 'createdAt', order: 'desc', limit: 8 }, { sortBy: 'createdAt', order: 'desc' }),
    this.shelf('Under $30', { maxPrice: 30, sortBy: 'price', order: 'asc', limit: 4 }, { maxPrice: 30, sortBy: 'price', order: 'asc' }),
  ];

  constructor() {
    super();
    this.shelves.forEach((shelf) => this.load(shelf));
  }

  load(shelf: Shelf): void {
    shelf.state.set('loading');
    this.api.list(shelf.query).subscribe({
      next: (page) => {
        shelf.products.set(page.items);
        shelf.state.set('ready');
      },
      error: (error: unknown) => {
        shelf.error.set(ApiError.from(error).message);
        shelf.state.set('error');
      },
    });
  }

  private shelf(title: string, query: ProductQuery, link: Shelf['link']): Shelf {
    return { title, query, link, state: signal<ViewState>('loading'), error: signal<string | null>(null), products: signal<Product[]>([]) };
  }
}
