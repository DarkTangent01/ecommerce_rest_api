import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { OrderApiService } from '../../core/api/domain-api.services';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { Order, PaginationMeta } from '../../shared/models/api.models';

@Component({
  selector: 'app-orders',
  imports: [CurrencyPipe, DatePipe, RouterLink, EmptyStateComponent],
  template: `
    <section class="page-header">
      <p class="eyebrow">Orders</p>
      <h1>Order history</h1>
    </section>
    <div class="table-card">
      @for (order of orders(); track order._id) {
        <a class="order-row" [routerLink]="['/orders', order._id]">
          <span>#{{ order._id.slice(-8) }}</span>
          <span>{{ order.createdAt | date:'mediumDate' }}</span>
          <span class="status" [class.warn]="order.status === 'pending'" [class.good]="order.status === 'delivered'">{{ order.status }}</span>
          <span class="status" [class.good]="order.paymentStatus === 'paid'" [class.bad]="order.paymentStatus === 'failed'">{{ order.paymentStatus }}</span>
          <strong>{{ order.total | currency:'USD' }}</strong>
        </a>
      } @empty {
        <app-empty-state title="No orders yet" description="Checkout will create your first pending order." icon="#" />
      }
    </div>
    @if (meta()) {
      <p class="muted">Showing {{ orders().length }} of {{ meta()?.total }} orders</p>
    }
  `,
})
export class OrdersComponent {
  readonly orders = signal<Order[]>([]);
  readonly meta = signal<PaginationMeta | null>(null);
  constructor() {
    inject(OrderApiService)
      .list()
      .subscribe((res) => {
        this.orders.set(res.data);
        this.meta.set(res.meta as PaginationMeta);
      });
  }
}
