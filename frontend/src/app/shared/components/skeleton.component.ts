import { Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  template: `
    <div class="skeleton-grid">
      @for (item of rows(); track item) {
        <div class="skeleton-card"></div>
      }
    </div>
  `,
})
export class SkeletonComponent {
  count = input(6);
  rows(): number[] {
    return Array.from({ length: this.count() }, (_, index) => index);
  }
}
