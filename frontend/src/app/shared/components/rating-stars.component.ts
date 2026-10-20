import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

/** Read-only star rating with an accessible text equivalent. */
@Component({
  selector: 'app-rating-stars',
  imports: [DecimalPipe, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span class="rating">
      <span class="stars" aria-hidden="true">
        @for (star of stars(); track $index) {
          <mat-icon>{{ star }}</mat-icon>
        }
      </span>
      <span class="visually-hidden">{{ value() | number: '1.1-1' }} out of 5 stars</span>
      @if (count() !== undefined) {
        <span class="count">({{ count() }})</span>
      }
    </span>
  `,
  styles: `
    .rating {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
    }
    .stars {
      display: inline-flex;
      color: #b8860b;
    }
    mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
  `,
})
export class RatingStarsComponent {
  readonly value = input(0);
  readonly count = input<number | undefined>(undefined);

  readonly stars = computed(() => {
    const rounded = Math.round(Math.max(0, Math.min(5, this.value())) * 2) / 2;
    return Array.from({ length: 5 }, (_, i) => (rounded >= i + 1 ? 'star' : rounded >= i + 0.5 ? 'star_half' : 'star_border'));
  });
}
