import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CartStateService } from '../../core/cart/cart-state.service';
import { ToastService } from '../../shared/components/toast.service';

@Component({
  selector: 'app-register',
  imports: [ReactiveFormsModule, RouterLink],
  template: `
    <section class="auth-page">
      <div class="auth-panel">
        <p class="eyebrow">Create account</p>
        <h1>Create your shopping profile.</h1>
        <p class="muted">Save products, checkout faster, and track your orders across sessions.</p>
        <form [formGroup]="form" (ngSubmit)="submit()" class="form-grid">
          <label>Name <input formControlName="name" autocomplete="name" /></label>
          <label>Email <input formControlName="email" type="email" autocomplete="email" /></label>
          <label>Password
            <span class="password-wrap">
              <input formControlName="password" [type]="showPassword() ? 'text' : 'password'" autocomplete="new-password" />
              <button type="button" (click)="showPassword.set(!showPassword())">{{ showPassword() ? 'Hide' : 'Show' }}</button>
            </span>
            <small>Password must include uppercase, lowercase, and a number.</small>
          </label>
          <label>Repeat password <input formControlName="repeat_password" [type]="showPassword() ? 'text' : 'password'" autocomplete="new-password" /></label>
          <button class="button primary wide" [disabled]="form.invalid || loading" type="submit">{{ loading ? 'Creating...' : 'Register' }}</button>
        </form>
        <p class="muted">Already have an account? <a routerLink="/login">Log in</a></p>
      </div>
    </section>
  `,
})
export class RegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);
  private readonly cartState = inject(CartStateService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  readonly showPassword = signal(false);
  loading = false;
  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(8)]],
    repeat_password: ['', Validators.required],
  });

  submit(): void {
    if (this.form.invalid || this.form.value.password !== this.form.value.repeat_password) {
      this.toast.show('Passwords must match and include uppercase, lowercase, and a number.', 'error');
      return;
    }
    this.loading = true;
    this.auth.register(this.form.getRawValue()).subscribe({
      next: () => {
        this.auth.loadProfile().subscribe();
        this.cartState.load();
        this.toast.show('Account created', 'success');
        void this.router.navigateByUrl('/products');
      },
      error: (err) => {
        this.loading = false;
        this.toast.show(err.error?.message ?? 'Registration failed', 'error');
      },
    });
  }
}
