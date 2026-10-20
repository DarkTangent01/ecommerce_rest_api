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
import { errorMessage } from '../../shared/forms/form-errors';
import { safeReturnUrl } from '../../shared/forms/validators';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink, MatButtonModule, MatCardModule, MatFormFieldModule, MatIconModule, MatInputModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './login.component.html',
  styleUrl: './auth-page.scss',
})
export class LoginComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  /** Bound from the query string by withComponentInputBinding(). */
  readonly returnUrl = input<string>();
  readonly reason = input<string>();

  readonly submitting = signal(false);
  readonly formError = signal<string | null>(null);
  readonly showPassword = signal(false);
  readonly errorMessage = errorMessage;

  readonly form = this.fb.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(RULES.email.max)]],
    password: ['', [Validators.required, Validators.maxLength(RULES.loginPassword.max)]],
  });

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.submitting()) return;

    this.submitting.set(true);
    this.formError.set(null);
    this.auth.login(this.form.getRawValue()).subscribe({
      next: (user) => {
        this.toast.show(`Welcome back, ${user.name}.`, 'success');
        if (this.auth.stepUpRequired()) {
          this.toast.show('We noticed unusual sign-in activity. Some actions such as checkout are blocked for this session.', 'info');
        }
        void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
      },
      error: (error: unknown) => {
        this.submitting.set(false);
        const apiError = ApiError.from(error);
        // Same message for unknown email and wrong password, as the backend intends.
        this.formError.set(apiError.status === 401 ? 'Email or password is incorrect.' : apiError.message);
      },
    });
  }
}
