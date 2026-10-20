import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { OrdersApi } from '../../core/api/orders.api';
import { RULES } from '../../core/config/validation';
import { ApiError } from '../../core/http/api-error';
import type { Id, Shipment, ShipmentStatus } from '../../core/models';
import { applyServerErrors, errorMessage } from '../../shared/forms/form-errors';
import { httpsUrl, notBlank } from '../../shared/forms/validators';

export interface ShipmentDialogData {
  orderId: Id;
}

const STATUSES: { value: ShipmentStatus; label: string }[] = [
  { value: 'label_created', label: 'Label created' },
  { value: 'in_transit', label: 'In transit' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'failed', label: 'Delivery failed' },
];

/** PUT /orders/:id/shipment. The backend only accepts paid, open orders and moves order status forward. */
@Component({
  selector: 'app-shipment-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>Update shipment</h2>
    <form [formGroup]="form" (ngSubmit)="save()">
      <mat-dialog-content class="fields">
        <mat-form-field>
          <mat-label>Carrier</mat-label>
          <input matInput formControlName="carrier" [maxlength]="rules.shipment.carrier" required cdkFocusInitial />
          @if (form.controls.carrier.invalid) {
            <mat-error>{{ errorMessage(form.controls.carrier, 'Carrier') }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Tracking number</mat-label>
          <input matInput formControlName="trackingNumber" [maxlength]="rules.shipment.trackingNumber" required />
          @if (form.controls.trackingNumber.invalid) {
            <mat-error>{{ errorMessage(form.controls.trackingNumber, 'Tracking number') }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Tracking URL (optional)</mat-label>
          <input matInput formControlName="trackingUrl" type="url" placeholder="https://" [maxlength]="rules.shipment.trackingUrl" />
          @if (form.controls.trackingUrl.invalid) {
            <mat-error>{{ errorMessage(form.controls.trackingUrl, 'Tracking URL') }}</mat-error>
          }
        </mat-form-field>
        <mat-form-field>
          <mat-label>Status</mat-label>
          <mat-select formControlName="status">
            @for (status of statuses; track status.value) {
              <mat-option [value]="status.value">{{ status.label }}</mat-option>
            }
          </mat-select>
        </mat-form-field>
        @if (error(); as message) {
          <p class="error" role="alert">{{ message }}</p>
        }
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Cancel</button>
        <button mat-flat-button type="submit" [disabled]="saving()">Save</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .fields {
      display: grid;
      gap: 4px;
      min-width: min(420px, 80vw);
    }
    .error {
      color: var(--mat-sys-error);
    }
  `,
})
export class ShipmentDialogComponent {
  private readonly data = inject<ShipmentDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ShipmentDialogComponent, Shipment>>(MatDialogRef);
  private readonly api = inject(OrdersApi);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly rules = RULES;
  readonly statuses = STATUSES;
  readonly errorMessage = errorMessage;
  readonly saving = signal(false);
  readonly error = signal<string | null>(null);

  readonly form = this.fb.group({
    carrier: ['', [Validators.required, notBlank, Validators.maxLength(RULES.shipment.carrier)]],
    trackingNumber: ['', [Validators.required, notBlank, Validators.maxLength(RULES.shipment.trackingNumber)]],
    trackingUrl: ['', [Validators.maxLength(RULES.shipment.trackingUrl), httpsUrl]],
    status: ['label_created' as ShipmentStatus, Validators.required],
  });

  save(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.saving()) return;
    const { carrier, trackingNumber, trackingUrl, status } = this.form.getRawValue();
    this.saving.set(true);
    this.error.set(null);
    this.api
      .upsertShipment(this.data.orderId, { carrier: carrier.trim(), trackingNumber: trackingNumber.trim(), status, ...(trackingUrl.trim() && { trackingUrl: trackingUrl.trim() }) })
      .subscribe({
        next: (shipment) => this.ref.close(shipment),
        error: (error: unknown) => {
          this.saving.set(false);
          const apiError = ApiError.from(error);
          applyServerErrors(this.form, apiError);
          this.error.set(apiError.message);
        },
      });
  }
}
