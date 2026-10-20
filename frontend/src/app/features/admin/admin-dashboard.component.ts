import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AdminApi } from '../../core/api/admin.api';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';

@Component({
  selector: 'app-admin-dashboard',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, AsyncStateComponent, EmptyStateComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-dashboard.component.html',
  styleUrl: './admin.scss',
})
export class AdminDashboardComponent {
  private readonly api = inject(AdminApi);

  readonly analytics = rxResource({ stream: () => this.api.analytics() });
  readonly analyticsState = computed(() => viewStateOf(this.analytics));
  readonly analyticsError = computed(() => errorMessageOf(this.analytics));

  readonly signals = rxResource({ stream: () => this.api.securitySignals() });
  readonly signalsState = computed(() => viewStateOf(this.signals));
  readonly recentSignals = computed(() => (this.signals.value() ?? []).slice(0, 8));

  readonly sections = [
    { link: '/admin/products', icon: 'inventory_2', title: 'Products', text: 'Create, edit and retire products.' },
    { link: '/admin/orders', icon: 'local_shipping', title: 'Orders', text: 'Track payments, ship, cancel or request refunds.' },
    { link: '/admin/coupons', icon: 'sell', title: 'Coupons', text: 'Discount codes and their limits.' },
    { link: '/admin/settings', icon: 'tune', title: 'Store settings', text: 'Store name, currency and status.' },
  ];
}
