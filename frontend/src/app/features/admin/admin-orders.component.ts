import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { OrdersApi } from '../../core/api/orders.api';
import type { Order, Shipment } from '../../core/models';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { ToastService } from '../../shared/components/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';
import { ShipmentDialogComponent, type ShipmentDialogData } from './shipment-dialog.component';

const PAGE_SIZE = 20;

/**
 * Tenant-wide order list for admins. Status changes are limited to what the API allows: shipment
 * updates (paid, open orders), cancel and refund request (from the order page). There is no
 * endpoint for setting an arbitrary status or approving refunds.
 */
@Component({
  selector: 'app-admin-orders',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, MatMenuModule, MatPaginatorModule, AsyncStateComponent, EmptyStateComponent, StatusChipComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-orders.component.html',
  styleUrl: './admin.scss',
})
export class AdminOrdersComponent {
  private readonly api = inject(OrdersApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly pageSize = PAGE_SIZE;
  readonly page = signal(1);
  readonly orders = rxResource({ params: () => this.page(), stream: ({ params }) => this.api.list({ page: params, limit: PAGE_SIZE }) });
  readonly state = computed(() => viewStateOf(this.orders));
  readonly error = computed(() => errorMessageOf(this.orders));

  canShip(order: Order): boolean {
    return order.paymentStatus === 'paid' && ['confirmed', 'processing', 'shipped'].includes(order.status);
  }

  changePage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
  }

  ship(order: Order): void {
    this.dialog
      .open<ShipmentDialogComponent, ShipmentDialogData, Shipment>(ShipmentDialogComponent, { data: { orderId: order._id } })
      .afterClosed()
      .pipe(filter((shipment): shipment is Shipment => Boolean(shipment)))
      .subscribe(() => {
        this.toast.show('Shipment updated.', 'success');
        this.orders.reload();
      });
  }
}
