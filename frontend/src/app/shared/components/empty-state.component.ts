import { Component, input } from '@angular/core';

@Component({
  selector: 'app-empty-state',
  template: `
    <div class="empty-state">
      <div class="empty-icon">{{ icon() }}</div>
      <h3>{{ title() }}</h3>
      <p>{{ description() }}</p>
    </div>
  `,
})
export class EmptyStateComponent {
  title = input('Nothing here yet');
  description = input('Once data is available, it will appear here.');
  icon = input('—');
}
