import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { AdminApi } from '../../core/api/admin.api';
import { RULES } from '../../core/config/validation';
import { ApiError } from '../../core/http/api-error';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { ToastService } from '../../shared/components/toast.service';
import { applyServerErrors, errorMessage } from '../../shared/forms/form-errors';
import { notBlank } from '../../shared/forms/validators';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';

/** PUT /tenant. The backend only lets an admin edit their own tenant. */
@Component({
  selector: 'app-tenant-settings',
  imports: [ReactiveFormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, AsyncStateComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <header class="page-header">
        <div>
          <p class="eyebrow">Admin</p>
          <h1>Store settings</h1>
          @if (tenant.value(); as t) {
            <p>Store key: <code>{{ t.key }}</code></p>
          }
        </div>
      </header>
      <app-async-state [state]="state()" [errorMessage]="error()" (retry)="tenant.reload()">
        <form class="surface form-grid two" [formGroup]="form" (ngSubmit)="save()" novalidate>
          <mat-form-field class="full">
            <mat-label>Store name</mat-label>
            <input matInput formControlName="name" [maxlength]="rules.tenant.name" required />
            @if (form.controls.name.invalid) {
              <mat-error>{{ errorMessage(form.controls.name, 'Store name') }}</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label>Status</mat-label>
            <mat-select formControlName="status">
              <mat-option value="active">Active</mat-option>
              <mat-option value="suspended">Suspended</mat-option>
            </mat-select>
          </mat-form-field>
          <mat-form-field>
            <mat-label>Currency (ISO code)</mat-label>
            <input matInput formControlName="currency" maxlength="3" />
            @if (form.controls.currency.invalid) {
              <mat-error>Use a 3-letter code such as USD.</mat-error>
            }
          </mat-form-field>
          <mat-form-field>
            <mat-label>Locale</mat-label>
            <input matInput formControlName="locale" [maxlength]="rules.tenant.locale" />
          </mat-form-field>
          <mat-form-field>
            <mat-label>Payment provider</mat-label>
            <input matInput formControlName="paymentProvider" [maxlength]="rules.tenant.paymentProvider" />
          </mat-form-field>
          @if (formError(); as message) {
            <p class="full" role="alert">{{ message }}</p>
          }
          <div class="full">
            <button mat-flat-button type="submit" [disabled]="saving()">{{ saving() ? 'Saving…' : 'Save settings' }}</button>
          </div>
        </form>
      </app-async-state>
    </div>
  `,
})
export class TenantSettingsComponent {
  private readonly api = inject(AdminApi);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly toast = inject(ToastService);

  readonly tenant = rxResource({ stream: () => this.api.tenant() });
  readonly state = computed(() => viewStateOf(this.tenant));
  readonly error = computed(() => errorMessageOf(this.tenant));
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);
  readonly rules = RULES;
  readonly errorMessage = errorMessage;

  readonly form = this.fb.group({
    name: ['', [Validators.required, notBlank, Validators.maxLength(RULES.tenant.name)]],
    status: ['active' as 'active' | 'suspended'],
    currency: ['USD', Validators.pattern(/^[A-Za-z]{3}$/)],
    locale: ['en-US', Validators.maxLength(RULES.tenant.locale)],
    paymentProvider: ['manual', Validators.maxLength(RULES.tenant.paymentProvider)],
  });

  constructor() {
    effect(() => {
      const tenant = this.tenant.value();
      if (!tenant) return;
      this.form.reset({
        name: tenant.name ?? '',
        status: tenant.status === 'suspended' ? 'suspended' : 'active',
        currency: tenant.config?.currency ?? 'USD',
        locale: tenant.config?.locale ?? 'en-US',
        paymentProvider: tenant.config?.paymentProvider ?? 'manual',
      });
    });
  }

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const { name, status, currency, locale, paymentProvider } = this.form.getRawValue();
    this.saving.set(true);
    this.formError.set(null);
    this.api.updateTenant({ name: name.trim(), status, config: { currency: currency.toUpperCase(), locale, paymentProvider } }).subscribe({
      next: (tenant) => {
        this.saving.set(false);
        this.tenant.set(tenant);
        this.toast.show('Store settings saved.', 'success');
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const apiError = ApiError.from(error);
        const unmatched = applyServerErrors(this.form, apiError, { 'config.currency': 'currency', 'config.locale': 'locale', 'config.paymentProvider': 'paymentProvider' });
        this.formError.set(unmatched.length || !apiError.fieldErrors.length ? apiError.message : null);
      },
    });
  }
}
