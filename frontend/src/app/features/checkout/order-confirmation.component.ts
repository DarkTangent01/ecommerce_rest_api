import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { OrdersApi } from '../../core/api/orders.api';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { StatusChipComponent } from '../../shared/components/status-chip.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';

/** Shown after checkout. All amounts come from the order the server created. */
@Component({
  selector: 'app-order-confirmation',
  imports: [RouterLink, MatButtonModule, MatIconModule, AsyncStateComponent, StatusChipComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="page">
      <app-async-state [state]="state()" [errorMessage]="error()" (retry)="order.reload()">
        @if (order.value(); as item) {
          <section class="confirmation surface" aria-labelledby="confirmation-title">
            <mat-icon class="done" aria-hidden="true">check_circle</mat-icon>
            <h1 id="confirmation-title">Thank you, your order is placed</h1>
            <p class="muted">Order number <strong>{{ item._id }}</strong></p>

            <div class="status">
              <span>Order <app-status-chip [status]="item.status" /></span>
              <span>Payment <app-status-chip [status]="item.paymentStatus" /></span>
            </div>
            @if (item.paymentStatus === 'unpaid') {
              <p class="muted">We will confirm your order as soon as the payment has been received. Unpaid orders are cancelled automatically after a short while.</p>
            }

            <dl class="totals">
              <div class="summary-row"><dt>Subtotal</dt><dd>{{ item.subtotal ?? item.total | money }}</dd></div>
              @if (item.discountTotal > 0) {
                <div class="summary-row"><dt>Discount</dt><dd>−{{ item.discountTotal | money }}</dd></div>
              }
              <div class="summary-row total"><dt>Total</dt><dd>{{ item.total | money }}</dd></div>
            </dl>

            <div class="actions">
              <a mat-flat-button [routerLink]="['/account/orders', item._id]">View order</a>
              <a mat-button routerLink="/products">Continue shopping</a>
            </div>
          </section>
        }
      </app-async-state>
    </div>
  `,
  styles: `
    .confirmation {
      max-width: 560px;
      margin: 0 auto;
      display: grid;
      gap: 12px;
      text-align: center;
      justify-items: center;
      padding: 32px 24px;
    }
    .done {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #0a7a43;
    }
    .status {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .totals {
      width: 100%;
      margin: 8px 0;
    }
    dd {
      margin: 0;
    }
  `,
})
export class OrderConfirmationComponent {
  private readonly api = inject(OrdersApi);
  readonly id = input.required<string>();
  readonly order = rxResource({ params: () => this.id(), stream: ({ params }) => this.api.get(params) });
  readonly state = computed(() => viewStateOf(this.order));
  readonly error = computed(() => errorMessageOf(this.order));
}
