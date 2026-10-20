import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSelectModule } from '@angular/material/select';
import { AdminApi } from '../../core/api/admin.api';
import { RULES } from '../../core/config/validation';
import { ApiError } from '../../core/http/api-error';
import type { Coupon, CouponRequest, CouponType } from '../../core/models';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ToastService } from '../../shared/components/toast.service';
import { applyServerErrors, errorMessage } from '../../shared/forms/form-errors';
import { notBlank } from '../../shared/forms/validators';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';

const PAGE_SIZE = 20;
const toDateInput = (iso?: string) => (iso ? iso.slice(0, 10) : '');

@Component({
  selector: 'app-coupon-admin',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    MatSelectModule,
    AsyncStateComponent,
    EmptyStateComponent,
    MoneyPipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './coupon-admin.component.html',
  styleUrl: './admin.scss',
})
export class CouponAdminComponent {
  private readonly api = inject(AdminApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);

  readonly pageSize = PAGE_SIZE;
  readonly page = signal(1);
  readonly coupons = rxResource({ params: () => this.page(), stream: ({ params }) => this.api.coupons({ page: params, limit: PAGE_SIZE }) });
  readonly state = computed(() => viewStateOf(this.coupons));
  readonly error = computed(() => errorMessageOf(this.coupons));

  readonly editing = signal<Coupon | 'new' | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly errorMessage = errorMessage;
  readonly rules = RULES;

  readonly form = this.fb.group({
    code: ['', [Validators.required, notBlank, Validators.maxLength(RULES.coupon.code)]],
    type: ['percentage' as CouponType, Validators.required],
    value: [10, [Validators.required, Validators.min(0)]],
    maxDiscount: [null as number | null, Validators.min(0)],
    minOrderTotal: [0, [Validators.required, Validators.min(0)]],
    usageLimit: [100, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    perUserLimit: [1, [Validators.required, Validators.min(1), Validators.pattern(/^\d+$/)]],
    startsAt: [''],
    expiresAt: [''],
    isActive: [true],
  });

  open(coupon: Coupon | 'new'): void {
    this.formError.set(null);
    if (coupon === 'new') {
      this.form.reset();
    } else {
      this.form.reset({
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxDiscount: coupon.maxDiscount ?? null,
        minOrderTotal: coupon.minOrderTotal,
        usageLimit: coupon.usageLimit,
        perUserLimit: coupon.perUserLimit,
        startsAt: toDateInput(coupon.startsAt),
        expiresAt: toDateInput(coupon.expiresAt),
        isActive: coupon.isActive,
      });
    }
    this.editing.set(coupon);
  }

  changePage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
  }

  save(): void {
    this.form.markAllAsTouched();
    const editing = this.editing();
    if (this.form.invalid || this.saving() || !editing) return;
    const value = this.form.getRawValue();
    if (value.type === 'percentage' && value.value > 100) {
      this.form.controls.value.setErrors({ server: 'A percentage cannot exceed 100.' });
      return;
    }
    const body: CouponRequest = {
      code: value.code.trim().toUpperCase(),
      type: value.type,
      value: value.value,
      ...(value.maxDiscount !== null && { maxDiscount: value.maxDiscount }),
      minOrderTotal: value.minOrderTotal,
      usageLimit: value.usageLimit,
      perUserLimit: value.perUserLimit,
      ...(value.startsAt && { startsAt: value.startsAt }),
      ...(value.expiresAt && { expiresAt: value.expiresAt }),
      isActive: value.isActive,
    };

    this.saving.set(true);
    this.formError.set(null);
    const request = editing === 'new' ? this.api.createCoupon(body) : this.api.updateCoupon(editing._id, body);
    request.subscribe({
      next: (coupon) => {
        this.saving.set(false);
        this.toast.show(`Coupon ${coupon.code} saved.`, 'success');
        this.editing.set(null);
        this.coupons.reload();
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const apiError = ApiError.from(error);
        if (apiError.status === 409) {
          this.form.controls.code.setErrors({ server: 'This code already exists.' });
          return;
        }
        const unmatched = applyServerErrors(this.form, apiError);
        this.formError.set(unmatched.length || !apiError.fieldErrors.length ? apiError.message : null);
      },
    });
  }
}
