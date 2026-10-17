import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { OrderStatus, PaymentStatus, ShipmentStatus } from '../../core/models';

type Status = OrderStatus | PaymentStatus | ShipmentStatus;
type Tone = 'neutral' | 'good' | 'warn' | 'bad';

const TONES: Partial<Record<Status, Tone>> = {
  confirmed: 'good',
  processing: 'neutral',
  shipped: 'good',
  delivered: 'good',
  paid: 'good',
  pending: 'warn',
  unpaid: 'warn',
  authorized: 'neutral',
  refund_requested: 'warn',
  refunded: 'neutral',
  cancelled: 'bad',
  failed: 'bad',
  in_transit: 'good',
  label_created: 'neutral',
};

/** Coloured, readable label for order/payment/shipment states (colour is never the only cue). */
@Component({
  selector: 'app-status-chip',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="chip" [attr.data-tone]="tone()">{{ label() }}</span>`,
  styles: `
    .chip {
      display: inline-block;
      border-radius: 999px;
      padding: 2px 10px;
      font: var(--mat-sys-label-medium);
      text-transform: capitalize;
      background: var(--mat-sys-surface-container-high);
      color: var(--mat-sys-on-surface);
    }
    .chip[data-tone='good'] {
      background: #d7f5e3;
      color: #0a5130;
    }
    .chip[data-tone='warn'] {
      background: #fff1cc;
      color: #6b4a00;
    }
    .chip[data-tone='bad'] {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }
  `,
})
export class StatusChipComponent {
  readonly status = input.required<Status>();
  readonly tone = computed(() => TONES[this.status()] ?? 'neutral');
  readonly label = computed(() => this.status().replace(/_/g, ' '));
}
