import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-not-found',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page error-page">
      <mat-icon aria-hidden="true">travel_explore</mat-icon>
      <h1>Page not found</h1>
      <p class="muted">The page you were looking for does not exist or has moved.</p>
      <div class="actions">
        <a mat-flat-button routerLink="/">Go home</a>
        <a mat-stroked-button routerLink="/products">Browse products</a>
      </div>
    </section>
  `,
  styleUrl: './error-pages.scss',
})
export class NotFoundComponent {}

@Component({
  selector: 'app-unauthorized',
  imports: [MatButtonModule, MatIconModule, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="page error-page">
      <mat-icon aria-hidden="true">lock</mat-icon>
      <h1>You can't open this page</h1>
      <p class="muted">
        Your account ({{ auth.user()?.email }}) does not have access to this area. If you think this is wrong, contact an administrator.
      </p>
      <div class="actions">
        <a mat-flat-button routerLink="/">Go home</a>
      </div>
    </section>
  `,
  styleUrl: './error-pages.scss',
})
export class UnauthorizedComponent {
  readonly auth = inject(AuthService);
}
