import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

const LOW_STOCK = 5;

/** In stock / only N left / out of stock, from the stock count the backend reports. */
@Component({
  selector: 'app-stock-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="stock" [attr.data-level]="level()">{{ label() }}</span>`,
  styles: `
    .stock {
      font: var(--mat-sys-label-medium);
      color: #0a5130;
    }
    .stock[data-level='low'] {
      color: #8a5a00;
    }
    .stock[data-level='out'] {
      color: var(--mat-sys-error);
    }
  `,
})
export class StockBadgeComponent {
  readonly stock = input.required<number>();
  readonly level = computed(() => (this.stock() <= 0 ? 'out' : this.stock() <= LOW_STOCK ? 'low' : 'ok'));
  readonly label = computed(() => {
    const stock = this.stock();
    if (stock <= 0) return 'Out of stock';
    return stock <= LOW_STOCK ? `Only ${stock} left` : 'In stock';
  });
}
