import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { OrderApiService } from '../../core/api/domain-api.services';
import { ToastService } from '../../shared/components/toast.service';
import { Order } from '../../shared/models/api.models';

@Component({
  selector: 'app-order-detail',
  imports: [CurrencyPipe, DatePipe, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    @if (order(); as item) {
      <section class="page-header">
        <p class="eyebrow">Order #{{ item._id.slice(-8) }}</p>
        <h1>{{ item.total | currency: 'USD' }}</h1>
        <p>{{ item.createdAt | date: 'medium' }} · {{ item.status }} · {{ item.paymentStatus }}</p>
      </section>
      <section class="detail-layout">
        <div class="table-card">
          @for (line of item.items; track line.product) {
            <div class="order-row">
              <span>{{ line.name }}</span>
              <span>Qty {{ line.quantity }}</span>
              <strong>{{ line.price * line.quantity | currency: 'USD' }}</strong>
            </div>
          }
        </div>
        <aside class="summary-panel">
          <span>Payment</span>
          <strong>{{ item.paymentStatus }}</strong>
          <a class="button ghost wide" [routerLink]="['/payments', item._id]"
            >View payment status</a
          >
          @if (['pending', 'confirmed'].includes(item.status)) {
            <button class="button ghost wide" type="button" (click)="cancel(item._id)">Cancel order</button>
          }
          @if (item.paymentStatus === 'paid') {
            <button class="button ghost wide" type="button" (click)="refund(item._id)">Request refund</button>
          }
        </aside>
      </section>
    }
  `,
})
export class OrderDetailComponent {
  private readonly api = inject(OrderApiService);
  private readonly toast = inject(ToastService);
  readonly order = signal<Order | null>(null);
  constructor() {
    this.load();
  }
  load(): void {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
    this.api.get(id).subscribe((order) => this.order.set(order));
  }
  cancel(id: string): void {
    const reason = window.prompt('Cancellation reason');
    if (!reason) return;
    this.api.cancel(id, reason).subscribe((order) => {
      this.order.set(order);
      this.toast.show('Order cancelled', 'success');
    });
  }
  refund(id: string): void {
    const reason = window.prompt('Refund reason');
    if (!reason) return;
    this.api.refund(id, reason).subscribe((order) => {
      this.order.set(order);
      this.toast.show('Refund requested', 'success');
    });
  }
}
