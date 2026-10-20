import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { AccountApi } from '../../core/api/account.api';
import { AuthService } from '../../core/auth/auth.service';
import { ApiError } from '../../core/http/api-error';
import { ConfirmDialogComponent, type ConfirmDialogData } from '../../shared/components/confirm-dialog.component';
import { ToastService } from '../../shared/components/toast.service';

@Component({
  selector: 'app-profile',
  imports: [DatePipe, RouterLink, MatButtonModule, MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
})
export class ProfileComponent {
  readonly auth = inject(AuthService);
  private readonly api = inject(AccountApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  readonly exporting = signal(false);

  constructor() {
    // Refresh the profile so role/name changes made by an admin show up.
    this.auth.loadProfile().subscribe({ error: () => undefined });
  }

  exportData(): void {
    this.exporting.set(true);
    this.api.exportData().subscribe({
      next: (data) => {
        this.exporting.set(false);
        // Serialized and saved through a Blob URL: nothing is injected into the page.
        const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'my-account-data.json';
        link.click();
        URL.revokeObjectURL(url);
      },
      error: () => this.exporting.set(false),
    });
  }

  deleteAccount(): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: {
          title: 'Delete your account?',
          message: 'Your account will be deactivated and your personal details anonymised. This cannot be undone.',
          confirmLabel: 'Delete account',
          destructive: true,
        },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.deleteAccount()),
      )
      .subscribe({
        next: () => {
          this.toast.show('Your account has been deleted.', 'success');
          this.auth.logout('/');
        },
        error: (error: unknown) => {
          const apiError = ApiError.from(error);
          this.toast.show(
            apiError.status === 403 ? 'For your security, sign out and sign in again before deleting your account.' : apiError.message,
            'error',
          );
        },
      });
  }
}
