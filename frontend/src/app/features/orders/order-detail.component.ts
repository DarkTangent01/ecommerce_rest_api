import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { Observable, filter, switchMap } from 'rxjs';
import { OrdersApi } from '../../core/api/orders.api';
import { ApiError } from '../../core/http/api-error';
import type { Order } from '../../core/models';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { ReasonDialogComponent, type ReasonDialogData } from '../../shared/components/reason-dialog.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { ToastService } from '../../shared/components/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';

@Component({
  selector: 'app-order-detail',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule, AsyncStateComponent, StatusChipComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.scss',
})
export class OrderDetailComponent {
  private readonly api = inject(OrdersApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);

  readonly id = input.required<string>();
  readonly order = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  readonly state = computed(() => viewStateOf(this.order));
  readonly error = computed(() => errorMessageOf(this.order));

  /** Mirrors the backend rule; the server re-checks it atomically. */
  canCancel(order: Order): boolean {
    return order.status === 'pending' || order.status === 'confirmed';
  }

  canRequestRefund(order: Order): boolean {
    return order.paymentStatus === 'paid' && order.status !== 'refund_requested';
  }

  cancel(order: Order): void {
    this.withReason(
      { title: 'Cancel this order?', description: 'Reserved stock is released and the order cannot be restored.', confirmLabel: 'Cancel order', destructive: true },
      (reason) => this.api.cancel(order._id, { reason }),
      'Your order was cancelled.',
    );
  }

  requestRefund(order: Order): void {
    this.withReason(
      { title: 'Request a refund', description: 'Tell us why you would like a refund. We review every request.', confirmLabel: 'Request refund' },
      (reason) => this.api.requestRefund(order._id, { reason }),
      'Refund requested.',
    );
  }

  private withReason(data: ReasonDialogData, action: (reason: string) => Observable<Order>, success: string): void {
    this.dialog
      .open<ReasonDialogComponent, ReasonDialogData, string>(ReasonDialogComponent, { data, width: 'min(480px, 92vw)' })
      .afterClosed()
      .pipe(
        filter((reason): reason is string => Boolean(reason)),
        switchMap(action),
      )
      .subscribe({
        next: (updated) => {
          this.order.set(updated);
          this.toast.show(success, 'success');
        },
        error: (error: unknown) => {
          this.toast.show(ApiError.from(error).message, 'error');
          this.order.reload();
        },
      });
  }
}
