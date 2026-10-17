import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Superseded: ToastService now renders Material snack bars, which need no host element.
 * Kept only until the legacy shell that still renders <app-toast-host /> is replaced.
 */
@Component({
  selector: 'app-toast-host',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: '',
})
export class ToastComponent {}
