import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Placeholder product tiles shown while a grid or rail loads. Hidden from assistive technology. */
@Component({
  selector: 'app-product-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (i of slots(); track i) {
      <div class="tile">
        <span class="as-skeleton media"></span>
        <span class="as-skeleton line short"></span>
        <span class="as-skeleton line"></span>
        <span class="as-skeleton line price"></span>
      </div>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .tile {
      display: grid;
      gap: var(--as-space-2);
      padding-bottom: var(--as-space-3);
      background: var(--as-surface);
      border: 1px solid var(--as-border);
      border-radius: var(--as-radius-lg);
      overflow: hidden;
    }
    .media {
      aspect-ratio: 1;
      border-radius: 0;
    }
    .line {
      height: 12px;
      margin: 0 var(--as-space-3);
    }
    .short {
      width: 40%;
    }
    .price {
      width: 30%;
      height: 18px;
    }
  `,
})
export class ProductSkeletonComponent {
  readonly count = input(4);
  readonly slots = computed(() => Array.from({ length: this.count() }, (_, i) => i));
}
