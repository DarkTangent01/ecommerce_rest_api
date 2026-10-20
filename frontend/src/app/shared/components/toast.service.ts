import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';

export type ToastTone = 'success' | 'error' | 'info';

/** User-facing notifications via Material snack bars (announced to screen readers). */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  show(text: string, tone: ToastTone = 'info'): void {
    this.snackBar.open(text, 'Dismiss', {
      duration: tone === 'error' ? 7000 : 4000,
      panelClass: `toast-${tone}`,
      politeness: tone === 'error' ? 'assertive' : 'polite',
      horizontalPosition: 'center',
      verticalPosition: 'bottom',
    });
  }
}
