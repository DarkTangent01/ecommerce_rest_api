import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { OrdersApi } from '../../core/api/orders.api';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-orders',
  imports: [DatePipe, RouterLink, MatButtonModule, MatPaginatorModule, AsyncStateComponent, EmptyStateComponent, StatusChipComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.scss',
})
export class OrdersComponent {
  private readonly api = inject(OrdersApi);
  readonly pageSize = PAGE_SIZE;
  readonly page = signal(1);
  readonly orders = rxResource({ params: () => this.page(), stream: ({ params }) => this.api.list({ page: params, limit: PAGE_SIZE }) });
  readonly state = computed(() => viewStateOf(this.orders));
  readonly error = computed(() => errorMessageOf(this.orders));

  changePage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
  }
}
