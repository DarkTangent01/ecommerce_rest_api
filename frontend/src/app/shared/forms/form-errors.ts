import type { AbstractControl, FormGroup, ValidationErrors } from '@angular/forms';
import type { ApiError } from '../../core/http/api-error';

/** Human-readable message for the first error on a control. */
export const errorMessage = (control: AbstractControl | null, label: string): string => {
  const errors: ValidationErrors | null = control?.errors ?? null;
  if (!errors) return '';
  if (errors['required']) return `${label} is required.`;
  if (errors['email']) return 'Enter a valid email address.';
  if (errors['minlength']) return `${label} must be at least ${(errors['minlength'] as { requiredLength: number }).requiredLength} characters.`;
  if (errors['maxlength']) return `${label} must be at most ${(errors['maxlength'] as { requiredLength: number }).requiredLength} characters.`;
  if (errors['min']) return `${label} must be at least ${(errors['min'] as { min: number }).min}.`;
  if (errors['max']) return `${label} must be at most ${(errors['max'] as { max: number }).max}.`;
  if (errors['pattern']) return `${label} has an invalid format.`;
  if (errors['server']) return errors['server'] as string;
  const custom = Object.values(errors).find((value): value is string => typeof value === 'string');
  return custom ?? `${label} is invalid.`;
};

/**
 * Copies 422 field errors from the API onto matching form controls (`shippingAddress.city`
 * maps onto a nested group), so server-side rejections appear next to the field.
 * Returns the messages that matched no control.
 */
export const applyServerErrors = (form: FormGroup, error: ApiError, fieldMap: Record<string, string> = {}): string[] => {
  const unmatched: string[] = [];
  for (const { field, message } of error.fieldErrors) {
    const control = form.get(fieldMap[field] ?? field);
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: message });
      control.markAsTouched();
    } else {
      unmatched.push(field ? `${field}: ${message}` : message);
    }
  }
  return unmatched;
};
