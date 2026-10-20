import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { RULES } from '../../core/config/validation';
import { ApiError } from '../../core/http/api-error';
import { ToastService } from '../../shared/components/toast.service';
import { applyServerErrors, errorMessage } from '../../shared/forms/form-errors';
import { matchFields, notBlank, passwordStrength, safeReturnUrl } from '../../shared/forms/validators';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './register.component.html',
  styleUrl: './auth-page.scss',
})
export class RegisterComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly returnUrl = input<string>();
  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly errorMessage = errorMessage;
  readonly rules = RULES;

  readonly form = this.fb.group(
    {
      name: ['', [Validators.required, notBlank, Validators.minLength(RULES.name.min), Validators.maxLength(RULES.name.max)]],
      email: ['', [Validators.required, Validators.email, Validators.maxLength(RULES.email.max)]],
      password: ['', [Validators.required, Validators.minLength(RULES.password.min), Validators.maxLength(RULES.password.max), passwordStrength]],
      repeat_password: ['', Validators.required],
    },
    { validators: matchFields('password', 'repeat_password', 'Passwords do not match.') },
  );

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.formError.set(null);
    const value = this.form.getRawValue();
    this.auth.register({ ...value, name: value.name.trim() }).subscribe({
      next: (user) => {
        this.toast.show(`Welcome, ${user.name}! Your account is ready.`, 'success');
        void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const apiError = ApiError.from(error);
        if (apiError.status === 409) {
          this.form.controls.email.setErrors({ server: 'An account with this email already exists.' });
          return;
        }
        const unmatched = applyServerErrors(this.form, apiError);
        this.formError.set(unmatched.length || !apiError.fieldErrors.length ? apiError.message : null);
      },
    });
  }
}
