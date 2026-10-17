import { DatePipe } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { CouponApiService } from '../../core/api/domain-api.services';
import { ToastService } from '../../shared/components/toast.service';
import { Coupon } from '../../shared/models/api.models';

@Component({
  selector: 'app-coupon-admin',
  imports: [DatePipe, ReactiveFormsModule],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page-header">
      <p class="eyebrow">Admin</p>
      <h1>Coupons</h1>
    </section>
    <section class="checkout-layout">
      <form class="form-card" [formGroup]="form" (ngSubmit)="create()">
        <label>Code <input formControlName="code" /></label>
        <label
          >Type
          <select formControlName="type">
            <option value="percentage">Percentage</option>
            <option value="fixed">Fixed</option>
          </select>
        </label>
        <label>Value <input formControlName="value" type="number" /></label>
        <label>Minimum order <input formControlName="minOrderTotal" type="number" /></label>
        <label>Usage limit <input formControlName="usageLimit" type="number" /></label>
        <label>Per-user limit <input formControlName="perUserLimit" type="number" /></label>
        <button class="button primary wide" [disabled]="form.invalid" type="submit">
          Create coupon
        </button>
      </form>
      <div class="table-card">
        @for (coupon of coupons(); track coupon._id) {
          <div class="order-row">
            <span>{{ coupon.code }}</span>
            <span>{{ coupon.type }} {{ coupon.value }}</span>
            <span>{{ coupon.usedCount || 0 }}/{{ coupon.usageLimit }}</span>
            <span>{{ coupon.expiresAt | date: 'mediumDate' }}</span>
          </div>
        }
      </div>
    </section>
  `,
})
export class CouponAdminComponent {
  private readonly api = inject(CouponApiService);
  private readonly fb = inject(FormBuilder);
  private readonly toast = inject(ToastService);
  readonly coupons = signal<Coupon[]>([]);
  readonly form = this.fb.nonNullable.group({
    code: ['', Validators.required],
    type: ['percentage' as const, Validators.required],
    value: [10, [Validators.required, Validators.min(0)]],
    minOrderTotal: [0, Validators.min(0)],
    usageLimit: [100, Validators.min(1)],
    perUserLimit: [1, Validators.min(1)],
    isActive: true,
  });
  constructor() {
    this.load();
  }
  load(): void {
    this.api.list().subscribe((coupons) => this.coupons.set(coupons));
  }
  create(): void {
    this.api.create(this.form.getRawValue()).subscribe({
      next: () => {
        this.toast.show('Coupon created', 'success');
        this.form.reset({
          code: '',
          type: 'percentage',
          value: 10,
          minOrderTotal: 0,
          usageLimit: 100,
          perUserLimit: 1,
          isActive: true,
        });
        this.load();
      },
      error: (err) => this.toast.show(err.error?.message ?? 'Coupon create failed', 'error'),
    });
  }
}
