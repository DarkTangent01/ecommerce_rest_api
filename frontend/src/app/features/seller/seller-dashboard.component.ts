import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { SellerApiService } from '../../core/api/domain-api.services';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ToastService } from '../../shared/components/toast.service';
import { SellerDashboard } from '../../shared/models/api.models';

@Component({
  selector: 'app-seller-dashboard',
  imports: [CurrencyPipe, DatePipe, ReactiveFormsModule, EmptyStateComponent],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page-header">
      <p class="eyebrow">Seller</p>
      <h1>Seller dashboard</h1>
    </section>
    @if (dashboard(); as data) {
      <section class="dashboard-grid">
        <article class="stat-card">
          <span>Products</span><strong>{{ data.productCount }}</strong>
        </article>
        <article class="stat-card">
          <span>Revenue</span><strong>{{ data.revenue | currency: 'USD' }}</strong>
        </article>
        <article class="stat-card">
          <span>Low stock</span><strong>{{ data.lowStock.length }}</strong>
        </article>
      </section>
      <section class="section split">
        <article class="panel">
          <h2>Recent orders</h2>
          @for (order of data.recentOrders; track order._id) {
            <div class="order-row">
              <span>#{{ order._id.slice(-8) }}</span>
              <span>{{ order.createdAt | date: 'short' }}</span>
              <strong>{{ order.total | currency: 'USD' }}</strong>
            </div>
          } @empty {
            <app-empty-state
              title="No seller orders"
              description="Orders containing your products will appear here."
              icon="0"
            />
          }
        </article>
        <form class="form-card" [formGroup]="shipmentForm" (ngSubmit)="updateShipment()">
          <h2>Update shipment</h2>
          <label>Order ID <input formControlName="orderId" /></label>
          <label>Carrier <input formControlName="carrier" /></label>
          <label>Tracking number <input formControlName="trackingNumber" /></label>
          <label>Tracking URL <input formControlName="trackingUrl" /></label>
          <label
            >Status
            <select formControlName="status">
              <option value="label_created">Label created</option>
              <option value="in_transit">In transit</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
          </label>
          <button class="button primary wide" type="submit" [disabled]="shipmentForm.invalid">
            Save shipment
          </button>
        </form>
      </section>
    }
  `,
})
export class SellerDashboardComponent {
  private readonly api = inject(SellerApiService);
  private readonly toast = inject(ToastService);
  private readonly fb = inject(FormBuilder);
  readonly dashboard = signal<SellerDashboard | null>(null);
  readonly shipmentForm = this.fb.nonNullable.group({
    orderId: ['', Validators.required],
    carrier: ['', Validators.required],
    trackingNumber: ['', Validators.required],
    trackingUrl: '',
    status: ['label_created' as const, Validators.required],
  });
  constructor() {
    this.api.dashboard().subscribe((data) => this.dashboard.set(data));
  }
  updateShipment(): void {
    const { orderId, ...payload } = this.shipmentForm.getRawValue();
    this.api.updateShipment(orderId, payload).subscribe({
      next: () => this.toast.show('Shipment updated', 'success'),
      error: (err) => this.toast.show(err.error?.message ?? 'Shipment update failed', 'error'),
    });
  }
}
