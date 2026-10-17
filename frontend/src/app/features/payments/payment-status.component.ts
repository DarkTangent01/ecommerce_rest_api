import { CurrencyPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PaymentApiService } from '../../core/api/domain-api.services';
import { Order } from '../../shared/models/api.models';

@Component({
  selector: 'app-payment-status',
  imports: [CurrencyPipe, RouterLink],
  template: `
    <section class="payment-state">
      @if (status(); as item) {
        <p class="eyebrow">Payment status</p>
        <h1>{{ item.paymentStatus }}</h1>
        <p>Order #{{ item._id.slice(-8) }} · {{ item.total | currency:'USD' }} · Fulfillment {{ item.status }}</p>
        <p class="muted">This API accepts payment state changes only from the signed /payments/webhook endpoint.</p>
        <a class="button primary" [routerLink]="['/orders', item._id]">Back to order</a>
      }
    </section>
  `,
})
export class PaymentStatusComponent {
  readonly status = signal<Pick<Order, '_id' | 'status' | 'paymentStatus' | 'total'> | null>(null);
  constructor() {
    const id = inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '';
    inject(PaymentApiService)
      .statusFromOrder(id)
      .subscribe((status) => this.status.set(status));
  }
}
