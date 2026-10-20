import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';

export type ViewState = 'loading' | 'error' | 'ready';

/**
 * Renders a loading spinner or an error with retry, and otherwise the projected content.
 * Every data view wraps its content in this so loading and failure are never blank screens.
 */
@Component({
  selector: 'app-async-state',
  imports: [MatButtonModule, MatIconModule, MatProgressSpinnerModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (state()) {
      @case ('loading') {
        <div role="status" aria-live="polite">
          <span class="visually-hidden">{{ loadingLabel() }}</span>
          <!-- Pages may project a skeleton with the asLoading attribute; otherwise a spinner. -->
          <ng-content select="[asLoading]">
            <div class="state">
              <mat-progress-spinner mode="indeterminate" diameter="40" aria-label="Loading" />
            </div>
          </ng-content>
        </div>
      }
      @case ('error') {
        <div class="state" role="alert">
          <mat-icon aria-hidden="true">error</mat-icon>
          <p>{{ errorMessage() || 'Something went wrong while loading this page.' }}</p>
          <button mat-stroked-button type="button" (click)="retry.emit()">Try again</button>
        </div>
      }
      @default {
        <ng-content />
      }
    }
  `,
  styles: `
    .state {
      display: grid;
      justify-items: center;
      gap: 12px;
      padding: 48px 16px;
      text-align: center;
    }
    mat-icon {
      color: var(--mat-sys-error);
      font-size: 40px;
      width: 40px;
      height: 40px;
    }
  `,
})
export class AsyncStateComponent {
  readonly state = input.required<ViewState>();
  readonly errorMessage = input<string | null>(null);
  readonly loadingLabel = input('Loading');
  readonly retry = output<void>();
}
