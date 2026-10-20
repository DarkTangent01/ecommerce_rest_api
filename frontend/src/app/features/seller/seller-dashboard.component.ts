import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { filter } from 'rxjs';
import { SellerApi } from '../../core/api/admin.api';
import type { SellerOrderSummary, Shipment } from '../../core/models';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { ToastService } from '../../shared/components/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';
import { ShipmentDialogComponent, type ShipmentDialogData } from '../admin/shipment-dialog.component';

@Component({
  selector: 'app-seller-dashboard',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, AsyncStateComponent, EmptyStateComponent, StatusChipComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './seller-dashboard.component.html',
  styleUrl: '../admin/admin.scss',
})
export class SellerDashboardComponent {
  private readonly api = inject(SellerApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly dashboard = rxResource({ stream: () => this.api.dashboard() });
  readonly state = computed(() => viewStateOf(this.dashboard));
  readonly error = computed(() => errorMessageOf(this.dashboard));

  canShip(order: SellerOrderSummary): boolean {
    return order.paymentStatus === 'paid' && ['confirmed', 'processing', 'shipped'].includes(order.status);
  }

  ship(order: SellerOrderSummary): void {
    this.dialog
      .open<ShipmentDialogComponent, ShipmentDialogData, Shipment>(ShipmentDialogComponent, { data: { orderId: order._id } })
      .afterClosed()
      .pipe(filter((shipment): shipment is Shipment => Boolean(shipment)))
      .subscribe(() => {
        this.toast.show('Shipment updated.', 'success');
        this.dashboard.reload();
      });
  }
}
