import { ChangeDetectionStrategy, Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink, type Params } from '@angular/router';
import type { Product } from '../../core/models';
import { WishlistStore } from '../../core/wishlist/wishlist.store';
import type { ViewState } from './async-state.component';
import { ProductCardComponent } from './product-card.component';
import { ProductSkeletonComponent } from './product-skeleton.component';

/**
 * A titled, horizontally scrolling shelf of product cards (scroll-snap; the arrow buttons are a
 * mouse convenience, touch and keyboard users scroll the list directly). Renders nothing when a
 * finished load is empty, so a merchandising row never shows as a blank box.
 */
@Component({
  selector: 'app-product-rail',
  imports: [RouterLink, MatButtonModule, MatIconModule, ProductCardComponent, ProductSkeletonComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[hidden]': "state() === 'ready' && products().length === 0" },
  template: `
    <section class="rail" [attr.aria-labelledby]="headingId">
      <header class="rail-head">
        <h2 [id]="headingId">{{ title() }}</h2>
        @if (seeAllQuery(); as query) {
          <a class="see-all" routerLink="/products" [queryParams]="query">See all <span class="visually-hidden">{{ title() }}</span></a>
        }
        <span class="arrows">
          <button mat-icon-button type="button" (click)="scroll(-1)" [attr.aria-label]="'Scroll ' + title() + ' back'">
            <mat-icon>chevron_left</mat-icon>
          </button>
          <button mat-icon-button type="button" (click)="scroll(1)" [attr.aria-label]="'Scroll ' + title() + ' forward'">
            <mat-icon>chevron_right</mat-icon>
          </button>
        </span>
      </header>

      @switch (state()) {
        @case ('error') {
          <p class="error" role="alert">
            Couldn't load {{ title() }}.
            <button mat-button type="button" (click)="retry.emit()">Try again</button>
          </p>
        }
        @case ('loading') {
          <div class="track"><app-product-skeleton [count]="5" /></div>
        }
        @default {
          <ul class="track" #track>
            @for (product of products(); track product._id) {
              <li>
                <app-product-card
                  [product]="product"
                  [saved]="wishlist.has(product._id)"
                  (addToCart)="addToCart.emit($event)"
                  (toggleWishlist)="toggleWishlist.emit($event)"
                />
              </li>
            }
          </ul>
        }
      }
    </section>
  `,
  styles: `
    .rail {
      padding: var(--as-space-5);
      background: var(--as-surface);
      border: 1px solid var(--as-border);
      border-radius: var(--as-radius-lg);
    }
    .rail-head {
      display: flex;
      align-items: center;
      gap: var(--as-space-4);
      margin-bottom: var(--as-space-4);
    }
    .see-all {
      font-size: var(--as-text-sm);
      font-weight: var(--as-weight-semibold);
    }
    .arrows {
      margin-left: auto;
      display: none;
    }
    @media (hover: hover) and (min-width: 768px) {
      .arrows {
        display: inline-flex;
      }
    }
    .track {
      display: grid;
      grid-auto-flow: column;
      grid-auto-columns: minmax(160px, 44%);
      gap: var(--as-space-3);
      margin: 0;
      padding: 0 0 var(--as-space-2);
      list-style: none;
      overflow-x: auto;
      overscroll-behavior-x: contain;
      scroll-snap-type: x mandatory;
      scroll-behavior: smooth;
    }
    .track > li,
    .track > app-product-skeleton ::ng-deep .tile {
      scroll-snap-align: start;
    }
    @media (min-width: 600px) {
      .track {
        grid-auto-columns: minmax(180px, 30%);
      }
    }
    @media (min-width: 1024px) {
      .track {
        grid-auto-columns: calc((100% - 4 * var(--as-space-3)) / 5);
      }
    }
    .error {
      margin: 0;
      color: var(--as-danger-700);
    }
  `,
})
export class ProductRailComponent {
  private static nextId = 0;
  readonly wishlist = inject(WishlistStore);

  readonly title = input.required<string>();
  readonly products = input<Product[]>([]);
  readonly state = input<ViewState>('ready');
  /** Query parameters for the "See all" link to the full results; omitted when there is none. */
  readonly seeAllQuery = input<Params | null>(null);

  readonly addToCart = output<Product>();
  readonly toggleWishlist = output<Product>();
  readonly retry = output<void>();

  readonly headingId = `rail-${ProductRailComponent.nextId++}`;
  private readonly track = viewChild<ElementRef<HTMLElement>>('track');

  scroll(direction: 1 | -1): void {
    const track = this.track()?.nativeElement;
    if (track) track.scrollBy({ left: direction * track.clientWidth * 0.9 });
  }
}
