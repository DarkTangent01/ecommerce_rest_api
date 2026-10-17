import { JsonPipe } from '@angular/common';
import { Component, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { ProfileApiService } from '../../core/api/domain-api.services';
import { AuthService } from '../../core/auth/auth.service';
import { ToastService } from '../../shared/components/toast.service';

@Component({
  selector: 'app-profile',
  imports: [JsonPipe],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <section class="page-header">
      <p class="eyebrow">Account</p>
      <h1>{{ auth.user()?.name || 'Profile' }}</h1>
      <p>{{ auth.user()?.email }} · {{ auth.user()?.role }}</p>
    </section>
    <section class="dashboard-grid">
      <article class="stat-card">
        <span>Tenant</span>
        <strong>{{ auth.user()?.tenant || 'default' }}</strong>
      </article>
      <article class="stat-card">
        <span>MFA</span>
        <strong>{{ auth.user()?.mfaEnabled ? 'Enabled' : 'Not enabled' }}</strong>
      </article>
    </section>
    <section class="section">
      <button class="button ghost" type="button" (click)="export()">Export my data</button>
      @if (exportData()) {
        <pre class="json-panel">{{ exportData() | json }}</pre>
      }
    </section>
  `,
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly profile = inject(ProfileApiService);
  private readonly toast = inject(ToastService);
  readonly exportData = signal<unknown | null>(null);
  constructor() {
    this.profile.me().subscribe((user) => this.auth.user.set(user));
  }
  export(): void {
    this.profile.exportData().subscribe({
      next: (data) => this.exportData.set(data),
      error: (err) => this.toast.show(err.error?.message ?? 'Export failed', 'error'),
    });
  }
}
