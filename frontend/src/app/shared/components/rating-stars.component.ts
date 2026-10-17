import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';

@Component({
  selector: 'app-rating-stars',
  imports: [DecimalPipe],
  template: `
    <span class="rating-stars" [attr.aria-label]="value() + ' out of 5 stars'">
      <span>{{ stars() }}</span>
      <strong>{{ value() | number: '1.1-1' }}</strong>
      @if (count() !== undefined) {
        <small>({{ count() }})</small>
      }
    </span>
  `,
})
export class RatingStarsComponent {
  value = input(0);
  count = input<number | undefined>(undefined);

  stars(): string {
    const rounded = Math.max(0, Math.min(5, Math.round(this.value())));
    return `${'★'.repeat(rounded)}${'☆'.repeat(5 - rounded)}`;
  }
}
