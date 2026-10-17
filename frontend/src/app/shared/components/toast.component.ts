import { Component, inject, ChangeDetectionStrategy } from '@angular/core';
import { ToastService } from './toast.service';

@Component({
  selector: 'app-toast-host',
  imports: [],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <div class="toast-host" aria-live="polite">
      @for (toast of toastService.messages(); track toast.id) {
        <button
          class="toast"
          [class]="toast.tone"
          type="button"
          (click)="toastService.dismiss(toast.id)"
        >
          {{ toast.text }}
        </button>
      }
    </div>
  `,
})
export class ToastComponent {
  readonly toastService = inject(ToastService);
}
