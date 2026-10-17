import { Component, ChangeDetectionStrategy } from '@angular/core';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';

@Component({
  selector: 'app-notifications',
  imports: [EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page-header">
      <p class="eyebrow">Notifications</p>
      <h1>Notification center</h1>
    </section>
    <app-empty-state
      title="No notification REST API is exposed"
      description="The backend has a notification model and queue service, but no mounted notification route. This page is intentionally honest rather than calling an invented endpoint."
      icon="!"
    />
  `,
})
export class NotificationsComponent {}
