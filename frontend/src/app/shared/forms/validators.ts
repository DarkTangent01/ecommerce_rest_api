import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';
import { RULES } from '../../core/config/validation';

/** Same rule as the backend's register schema: upper, lower and a digit. */
export const passwordStrength: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '');
  return value && !RULES.password.pattern.test(value) ? { passwordStrength: RULES.password.patternMessage } : null;
};

/** Group validator: `repeat` must equal `source`. The error is set on the repeat control. */
export const matchFields =
  (source: string, repeat: string, message: string): ValidatorFn =>
  (group: AbstractControl): ValidationErrors | null => {
    const repeatControl = group.get(repeat);
    if (!repeatControl) return null;
    const mismatch = Boolean(repeatControl.value) && group.get(source)?.value !== repeatControl.value;
    const { mismatch: _old, ...others } = repeatControl.errors ?? {};
    repeatControl.setErrors(mismatch ? { ...others, mismatch: message } : Object.keys(others).length ? others : null);
    return null;
  };

/** Rejects values that are only whitespace (the backend trims before checking `min(1)`). */
export const notBlank: ValidatorFn = (control: AbstractControl): ValidationErrors | null =>
  typeof control.value === 'string' && control.value.length > 0 && control.value.trim().length === 0 ? { required: true } : null;

/** Accepts an empty value or an https:// URL (shipment trackingUrl rule). */
export const httpsUrl: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const value = String(control.value ?? '').trim();
  if (!value) return null;
  try {
    return new URL(value).protocol === 'https:' ? null : { httpsUrl: 'Use an https:// URL.' };
  } catch {
    return { httpsUrl: 'Enter a valid URL.' };
  }
};

/** Only allows in-app paths as post-login redirects (blocks //evil.com and absolute URLs). */
export const safeReturnUrl = (value: string | null | undefined, fallback = '/'): string =>
  value && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\') ? value : fallback;
