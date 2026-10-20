import { ChangeDetectionStrategy, Component, computed, inject, signal, type WritableSignal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, type Params } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';
import { ProductsApi } from '../../core/api/products.api';
import { RecentlyViewedStore } from '../../core/catalog/recently-viewed.store';
import { CATEGORIES } from '../../core/config/catalog';
import type { Product, ProductQuery } from '../../core/models';
import type { ViewState } from '../../shared/components/async-state.component';
import { ProductRailComponent } from '../../shared/components/product-rail.component';
import { viewStateOf } from '../../shared/resource-state';
import { ProductGridPage } from './catalog-page.base';

interface Rail {
  title: string;
  query: ProductQuery;
  seeAll: Params;
  state: WritableSignal<ViewState>;
  products: WritableSignal<Product[]>;
}

/** Categories that get their own rail on the home page (each costs one request). */
export const FEATURED_CATEGORIES = ['electronics', 'kitchen', 'outdoors'] as const;
const RAIL_SIZE = 10;
const RECENT_RAIL_SIZE = 10;

/**
 * Storefront home. Every section is real catalogue data from GET /products. There are no
 * best-seller, trending or deals rows: the API has no sales ranking, popularity or discount data,
 * and inventing them would mislead shoppers.
 */
@Component({
  selector: 'app-home',
  imports: [RouterLink, MatButtonModule, MatIconModule, ProductRailComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent extends ProductGridPage {
  private readonly api = inject(ProductsApi);
  private readonly recentlyViewed = inject(RecentlyViewedStore);
  readonly categories = CATEGORIES;

  readonly newArrivals = this.rail('New arrivals', { sortBy: 'createdAt', order: 'desc' });
  readonly rails: Rail[] = [
    this.newArrivals,
    this.rail('Under $30', { maxPrice: 30, sortBy: 'price', order: 'asc' }),
    ...FEATURED_CATEGORIES.map((value) => {
      const label = CATEGORIES.find((c) => c.value === value)?.label ?? value;
      return this.rail(`Shop ${label}`, { category: value });
    }),
  ];

  /** Real product photos for the hero collage (the newest arrivals that have an image). */
  readonly heroImages = computed(() => this.newArrivals.products().filter((p) => p.image && p.stock > 0).slice(0, 3));

  /** Recently viewed, re-fetched so prices and stock are current; deleted products drop out. */
  readonly recent = rxResource({
    params: () => this.recentlyViewed.ids().slice(0, RECENT_RAIL_SIZE),
    stream: ({ params }) =>
      params.length === 0
        ? of([] as Product[])
        : forkJoin(params.map((id) => this.api.get(id).pipe(catchError(() => of(null))))).pipe(
            map((products) => products.filter((product): product is Product => product !== null)),
          ),
  });
  readonly recentState = computed(() => viewStateOf(this.recent));

  constructor() {
    super();
    this.rails.forEach((rail) => this.load(rail));
  }

  load(rail: Rail): void {
    rail.state.set('loading');
    this.api.list({ ...rail.query, limit: RAIL_SIZE }).subscribe({
      next: (page) => {
        rail.products.set(page.items);
        rail.state.set('ready');
      },
      error: () => rail.state.set('error'),
    });
  }

  private rail(title: string, query: ProductQuery): Rail {
    return {
      title,
      query,
      seeAll: query as Params,
      state: signal<ViewState>('loading'),
      products: signal<Product[]>([]),
    };
  }
}
