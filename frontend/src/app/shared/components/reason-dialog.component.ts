import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { RULES } from '../../core/config/validation';

export interface ReasonDialogData {
  title: string;
  description: string;
  confirmLabel: string;
  destructive?: boolean;
}

/** Asks for the `reason` the cancel/refund endpoints require (1–300 characters). Resolves to the reason or undefined. */
@Component({
  selector: 'app-reason-dialog',
  imports: [ReactiveFormsModule, MatButtonModule, MatDialogModule, MatFormFieldModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <form (ngSubmit)="confirm()">
      <mat-dialog-content>
        <p>{{ data.description }}</p>
        <mat-form-field class="full">
          <mat-label>Reason</mat-label>
          <textarea matInput [formControl]="reason" rows="3" [maxlength]="max" cdkFocusInitial required></textarea>
          <mat-hint align="end">{{ reason.value.length }} / {{ max }}</mat-hint>
          @if (reason.touched && reason.hasError('required')) {
            <mat-error>Please give a reason.</mat-error>
          }
        </mat-form-field>
      </mat-dialog-content>
      <mat-dialog-actions align="end">
        <button mat-button type="button" mat-dialog-close>Keep order</button>
        <button mat-flat-button type="submit" [class.destructive]="data.destructive">{{ data.confirmLabel }}</button>
      </mat-dialog-actions>
    </form>
  `,
  styles: `
    .full {
      width: 100%;
    }
    .destructive {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
})
export class ReasonDialogComponent {
  readonly data = inject<ReasonDialogData>(MAT_DIALOG_DATA);
  private readonly ref = inject<MatDialogRef<ReasonDialogComponent, string>>(MatDialogRef);
  readonly max = RULES.reason.max;
  readonly reason = new FormControl('', { nonNullable: true, validators: [Validators.required, Validators.maxLength(this.max)] });

  confirm(): void {
    const value = this.reason.value.trim();
    if (!value) {
      this.reason.setValue('');
      this.reason.markAsTouched();
      return;
    }
    this.ref.close(value);
  }
}
