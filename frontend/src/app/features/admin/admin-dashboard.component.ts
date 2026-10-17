import { CurrencyPipe, JsonPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminApiService } from '../../core/api/domain-api.services';
import { AdminAnalytics } from '../../shared/models/api.models';

@Component({
  selector: 'app-admin-dashboard',
  imports: [CurrencyPipe, JsonPipe, RouterLink],
  template: `
    <section class="page-header">
      <p class="eyebrow">Admin</p>
      <h1>Business overview</h1>
      <a class="button ghost" routerLink="/admin/coupons">Manage coupons</a>
    </section>
    @if (analytics(); as data) {
      <section class="dashboard-grid">
        <article class="stat-card"><span>Users</span><strong>{{ data.users }}</strong></article>
        <article class="stat-card"><span>Products</span><strong>{{ data.products }}</strong></article>
        <article class="stat-card"><span>Orders</span><strong>{{ data.orders }}</strong></article>
        <article class="stat-card"><span>Revenue</span><strong>{{ data.revenue | currency:'USD' }}</strong></article>
        <article class="stat-card"><span>Reviews</span><strong>{{ data.reviews }}</strong></article>
      </section>
    }
    <section class="section split">
      <article class="panel">
        <h2>Recent domain events</h2>
        <pre class="json-panel">{{ events() | json }}</pre>
      </article>
      <article class="panel">
        <h2>Security signals</h2>
        <pre class="json-panel">{{ signals() | json }}</pre>
      </article>
    </section>
  `,
})
export class AdminDashboardComponent {
  private readonly api = inject(AdminApiService);
  readonly analytics = signal<AdminAnalytics | null>(null);
  readonly events = signal<unknown[]>([]);
  readonly signals = signal<unknown[]>([]);
  constructor() {
    this.api.analytics().subscribe((data) => this.analytics.set(data));
    this.api.platformEvents().subscribe({ next: (events) => this.events.set(events), error: () => this.events.set([]) });
    this.api.securitySignals().subscribe({ next: (signals) => this.signals.set(signals), error: () => this.signals.set([]) });
  }
}
