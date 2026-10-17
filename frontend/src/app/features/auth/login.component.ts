import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CartStateService } from '../../core/cart/cart-state.service';
import { ToastService } from '../../shared/components/toast.service';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="auth-page">
      <div class="auth-panel">
        <p class="eyebrow">Welcome back</p>
        <h1>Sign in to continue shopping.</h1>
        <p class="muted">
          Access your cart, wishlist, order history, and role-aware seller/admin tools.
        </p>
        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <label
            >Email
            <input formControlName="email" type="email" autocomplete="email" />
            @if (form.controls.email.touched && form.controls.email.invalid) {
              <small class="field-error">Enter a valid email.</small>
            }
          </label>
          <label
            >Password
            <span class="password-wrap">
              <input
                formControlName="password"
                [type]="showPassword() ? 'text' : 'password'"
                autocomplete="current-password"
              />
              <button type="button" (click)="showPassword.set(!showPassword())">
                {{ showPassword() ? 'Hide' : 'Show' }}
              </button>
            </span>
          </label>
          <button class="button primary wide" [disabled]="form.invalid || loading" type="submit">
            {{ loading ? 'Signing in...' : 'Log in' }}
          </button>
        </form>
        <p class="muted">New here? <a routerLink="/register">Create an account</a></p>
      </div>
    </section>
  `,
})
export class LoginComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cartState = inject(CartStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly showPassword = signal(false);
  loading = false;
  readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid) return;
    this.loading = true;
    this.auth.login(this.form.getRawValue()).subscribe({
      next: () => {
        this.auth.loadProfile().subscribe();
        this.cartState.load();
        this.toast.show('Logged in successfully', 'success');
        void this.router.navigateByUrl('/products');
      },
      error: (err) => {
        this.loading = false;
        this.toast.show(err.error?.message ?? 'Login failed', 'error');
      },
    });
  }
}
