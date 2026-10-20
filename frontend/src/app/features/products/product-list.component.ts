import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource, takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators, type AbstractControl, type ValidationErrors } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { ActivatedRoute, Router, RouterLink, type Params } from '@angular/router';
import { map } from 'rxjs';
import { ProductsApi } from '../../core/api/products.api';
import { CATEGORIES, PAGE_SIZES } from '../../core/config/catalog';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ProductCardComponent } from '../../shared/components/product-card.component';
import { ProductSkeletonComponent } from '../../shared/components/product-skeleton.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';
import { ProductGridPage } from './catalog-page.base';
import { SORT_OPTIONS, parseProductQuery } from './product-query';

export type FilterKey = 'q' | 'category' | 'minPrice' | 'maxPrice';
export interface ActiveFilter {
  key: FilterKey;
  label: string;
}

const priceRange = (group: AbstractControl): ValidationErrors | null => {
  const { minPrice, maxPrice } = group.value as { minPrice: number | null; maxPrice: number | null };
  return minPrice !== null && maxPrice !== null && maxPrice < minPrice ? { priceRange: true } : null;
};

/**
 * Product listing and search. The URL is the source of truth: search, category, price range, sort
 * and page all live in the query string, so results are shareable and back/forward work. The
 * request is an rxResource keyed on that query, so a newer query cancels an older in-flight one.
 */
@Component({
  selector: 'app-product-list',
  imports: [
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
    ProductCardComponent,
    ProductSkeletonComponent,
  ],
  providers: [MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-list.component.html',
  styleUrl: './product-list.component.scss',
})
export class ProductListComponent extends ProductGridPage {
  private readonly api = inject(ProductsApi);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly money = inject(MoneyPipe);

  readonly categories = CATEGORIES;
  readonly sortOptions = SORT_OPTIONS;
  readonly pageSizes = PAGE_SIZES;
  readonly filtersOpen = signal(false);

  readonly query = toSignal(this.route.queryParamMap.pipe(map(parseProductQuery)), { requireSync: true });

  readonly results = rxResource({
    params: () => this.query(),
    stream: ({ params }) => this.api.list(params),
  });
  readonly state = computed(() => viewStateOf(this.results));
  readonly error = computed(() => errorMessageOf(this.results));
  readonly products = computed(() => this.results.value()?.items ?? []);
  readonly meta = computed(() => this.results.value()?.meta);
  readonly categoryLabel = computed(() => {
    const { category } = this.query();
    return category ? (CATEGORIES.find((c) => c.value === category)?.label ?? category) : null;
  });
  readonly heading = computed(() => {
    const { q } = this.query();
    if (q) return `Results for “${q}”`;
    return this.categoryLabel() ?? 'All products';
  });

  readonly activeFilters = computed<ActiveFilter[]>(() => {
    const { q, minPrice, maxPrice } = this.query();
    const chips: ActiveFilter[] = [];
    if (q) chips.push({ key: 'q', label: `“${q}”` });
    const category = this.categoryLabel();
    if (category) chips.push({ key: 'category', label: category });
    if (minPrice !== undefined) chips.push({ key: 'minPrice', label: `From ${this.money.transform(minPrice)}` });
    if (maxPrice !== undefined) chips.push({ key: 'maxPrice', label: `Up to ${this.money.transform(maxPrice)}` });
    return chips;
  });

  readonly filters = this.fb.group(
    {
      q: ['', Validators.maxLength(100)],
      minPrice: [null as number | null, Validators.min(0)],
      maxPrice: [null as number | null, Validators.min(0)],
      sort: [SORT_OPTIONS[0]!.value],
    },
    { validators: priceRange },
  );

  constructor() {
    super();
    // Keep the form in sync when the URL changes (back/forward, header search, links).
    effect(() => {
      const query = this.query();
      this.filters.setValue(
        {
          q: query.q ?? '',
          minPrice: query.minPrice ?? null,
          maxPrice: query.maxPrice ?? null,
          sort: `${query.sortBy}:${query.order}`,
        },
        { emitEvent: false },
      );
    });
    // Sorting applies immediately; the other fields wait for "Apply".
    this.filters.controls.sort.valueChanges.pipe(takeUntilDestroyed()).subscribe((sort) => {
      const option = SORT_OPTIONS.find((o) => o.value === sort) ?? SORT_OPTIONS[0]!;
      this.navigate({ sortBy: option.sortBy, order: option.order, page: null });
    });
  }

  applyFilters(): void {
    if (this.filters.invalid) return;
    const { q, minPrice, maxPrice } = this.filters.getRawValue();
    this.filtersOpen.set(false);
    this.navigate({ q: q.trim() || null, minPrice: minPrice ?? null, maxPrice: maxPrice ?? null, page: null });
  }

  categoryLink(category: string | null): Params {
    return { category, page: null };
  }

  removeFilter(key: FilterKey): void {
    this.navigate({ [key]: null, page: null });
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
