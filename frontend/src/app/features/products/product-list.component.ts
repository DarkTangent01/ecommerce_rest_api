import { ChangeDetectionStrategy, Component, computed, effect, inject } from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { ProductsApi } from '../../core/api/products.api';
import { CATEGORIES, PAGE_SIZES } from '../../core/config/catalog';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';
import { ProductGridPage } from './catalog-page.base';
import { SORT_OPTIONS, parseProductQuery } from './product-query';

@Component({
  selector: 'app-product-list',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    AsyncStateComponent,
    EmptyStateComponent,
    ProductCardComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent extends ProductGridPage {
  private readonly api = inject(ProductsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly categories = CATEGORIES;
  readonly sortOptions = SORT_OPTIONS;
  readonly pageSizes = PAGE_SIZES;

  /** The URL is the source of truth: filters, sort and page all live in the query string. */
  readonly query = toSignal(this.route.queryParamMap.pipe(map(parseProductQuery)), { requireSync: true });

  readonly results = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });
  readonly state = computed(() => viewStateOf(this.results));
  readonly error = computed(() => errorMessageOf(this.results));
  readonly products = computed(() => this.results.value()?.items ?? []);
  readonly meta = computed(() => this.results.value()?.meta);
  readonly heading = computed(() => {
    const { q, category } = this.query();
    if (q) return `Results for “${q}”`;
    return CATEGORIES.find((c) => c.value === category)?.label ?? 'All products';
  });

  readonly filters = this.fb.group({
    q: ['', Validators.maxLength(100)],
    category: [''],
    minPrice: [null as number | null, Validators.min(0)],
    maxPrice: [null as number | null, Validators.min(0)],
    sort: [SORT_OPTIONS[0]!.value],
  });

  constructor() {
    super();
    // Keep the form in sync when the URL changes (back/forward, header search, links).
    effect(() => {
      const query = this.query();
      this.filters.setValue(
        {
          q: query.q ?? '',
          category: query.category ?? '',
          minPrice: query.minPrice ?? null,
          maxPrice: query.maxPrice ?? null,
          sort: `${query.sortBy}:${query.order}`,
        },
        { emitEvent: false },
      );
    });
  }

  applyFilters(): void {
    if (this.filters.invalid) return;
    const { q, category, minPrice, maxPrice, sort } = this.filters.getRawValue();
    const option = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]!;
    this.navigate({
      q: q.trim() || null,
      category: category || null,
      minPrice: minPrice ?? null,
      maxPrice: maxPrice ?? null,
      sortBy: option.sortBy,
      order: option.order,
      page: null,
    });
  }

  clearFilters(): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: {} });
  }

  changePage(event: PageEvent): void {
    this.navigate({ page: event.pageIndex + 1, limit: event.pageSize });
  }

  private navigate(queryParams: Record<string, string | number | null>): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams, queryParamsHandling: 'merge' });
  }
}
