import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule, type MatAutocompleteSelectedEvent } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { NavigationEnd, Router } from '@angular/router';
import { catchError, debounceTime, distinctUntilChanged, filter, map, of, switchMap } from 'rxjs';
import { ProductsApi } from '../api/products.api';
import { CATEGORIES } from '../config/catalog';
import type { Product } from '../models';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

export const SUGGEST_MIN_LENGTH = 2;
export const SUGGEST_DEBOUNCE_MS = 250;

/**
 * Header search: scope select, search-as-you-type suggestions (real catalogue results, debounced,
 * stale responses discarded by switchMap) and a submit that opens the results page.
 */
@Component({
  selector: 'app-search-box',
  imports: [ReactiveFormsModule, MatAutocompleteModule, MatIconModule, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- No Angular form directive on this form, so handle submit directly and stop the native reload. -->
    <form class="search" role="search" (submit)="$event.preventDefault(); submit()">
      <label for="site-search-scope" class="visually-hidden">Search in</label>
      <select id="site-search-scope" class="scope" [formControl]="scope">
        <option value="">All</option>
        @for (category of categories; track category.value) {
          <option [value]="category.value">{{ category.label }}</option>
        }
      </select>
      <label for="site-search" class="visually-hidden">Search products</label>
      <input
        id="site-search"
        type="search"
        [formControl]="query"
        [matAutocomplete]="suggestionsPanel"
        placeholder="Search AeroScript"
        maxlength="100"
        autocomplete="off"
        enterkeyhint="search"
      />
      <button class="go" type="submit" aria-label="Search">
        <mat-icon aria-hidden="true">search</mat-icon>
      </button>
    </form>

    <mat-autocomplete #suggestionsPanel="matAutocomplete" class="as-suggestions" (optionSelected)="open($event)">
      @for (product of suggestions(); track product._id) {
        <mat-option [value]="product">
          <span class="suggestion">
            <img [src]="product.image" alt="" width="32" height="32" loading="lazy" />
            <span class="name">{{ product.name }}</span>
            <span class="price">{{ product.price | money }}</span>
          </span>
        </mat-option>
      }
    </mat-autocomplete>
  `,
  styles: `
    .search {
      display: flex;
      align-items: stretch;
      height: 42px;
      width: 100%;
      background: var(--as-white);
      border-radius: var(--as-radius-md);
      overflow: hidden;
      box-shadow: inset 0 0 0 2px transparent;
      transition: box-shadow var(--as-duration-fast) var(--as-ease);
    }
    .search:focus-within {
      box-shadow: inset 0 0 0 2px var(--as-flare-500);
    }
    .scope {
      flex: none;
      max-width: 9.5rem;
      border: 0;
      border-right: 1px solid var(--as-border);
      background: var(--as-gray-100);
      color: var(--as-text);
      font: inherit;
      font-size: var(--as-text-sm);
      padding: 0 var(--as-space-2);
      cursor: pointer;
    }
    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      padding: 0 var(--as-space-3);
      font: inherit;
      color: var(--as-text);
      background: transparent;
    }
    .go {
      flex: none;
      width: 48px;
      border: 0;
      background: var(--as-flare-500);
      color: var(--as-on-flare);
      cursor: pointer;
      display: grid;
      place-items: center;
    }
    .go:hover {
      background: var(--as-flare-600);
    }
    .suggestion {
      display: grid;
      grid-template-columns: 32px 1fr auto;
      gap: var(--as-space-3);
      align-items: center;
    }
    .suggestion img {
      width: 32px;
      height: 32px;
      object-fit: cover;
      border-radius: var(--as-radius-sm);
      background: var(--as-gray-100);
    }
    .name {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .price {
      font-weight: var(--as-weight-semibold);
    }
    @media (max-width: 599.98px) {
      .scope {
        max-width: 5.5rem;
      }
    }
  `,
})
export class SearchBoxComponent {
  private readonly api = inject(ProductsApi);
  private readonly router = inject(Router);

  readonly categories = CATEGORIES;
  readonly scope = new FormControl('', { nonNullable: true });
  // Holds a Product briefly when an option is picked, so it is typed as a union.
  readonly query = new FormControl<string | Product>('', { nonNullable: true });
  readonly suggestions = signal<Product[]>([]);

  constructor() {
    const typed = this.query.valueChanges.pipe(
      filter((value): value is string => typeof value === 'string'),
      map((value) => value.trim()),
    );
    typed
      .pipe(
        debounceTime(SUGGEST_DEBOUNCE_MS),
        distinctUntilChanged(),
        switchMap((q) =>
          q.length < SUGGEST_MIN_LENGTH
            ? of([])
            : this.api.suggest(q, this.scope.value).pipe(
                map((page) => page.items),
                // Suggestions are best-effort: a failed lookup just shows none.
                catchError(() => of([])),
              ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((items) => this.suggestions.set(items));

    // Mirror the URL so the box shows what the results page is showing. Only on actual navigations
    // (and once now): a deferred sync could overwrite text the shopper has already started typing.
    this.syncFromUrl();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe(() => this.syncFromUrl());
  }

  private syncFromUrl(): void {
    const tree = this.router.parseUrl(this.router.url);
    const onResults = tree.root.children['primary']?.segments.map((s) => s.path).join('/') === 'products';
    this.query.setValue(onResults ? ((tree.queryParams['q'] as string | undefined) ?? '') : '', { emitEvent: false });
    this.scope.setValue(onResults ? ((tree.queryParams['category'] as string | undefined) ?? '') : '', { emitEvent: false });
  }

  submit(): void {
    const value = this.query.value;
    const q = typeof value === 'string' ? value.trim() : value.name;
    this.suggestions.set([]);
    void this.router.navigate(['/products'], { queryParams: { q: q || null, category: this.scope.value || null } });
  }

  open(event: MatAutocompleteSelectedEvent): void {
    const product = event.option.value as Product;
    this.query.setValue('', { emitEvent: false });
    this.suggestions.set([]);
    void this.router.navigate(['/products', product._id]);
  }
}
