import { BreakpointObserver } from '@angular/cdk/layout';
import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatBadgeModule } from '@angular/material/badge';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CartStore } from '../cart/cart.store';
import { APP_SETTINGS } from '../config/app.config';
import { LoadingService } from '../loading/loading.service';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    ReactiveFormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatMenuModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    MatProgressBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartStore);
  readonly loading = inject(LoadingService);
  readonly appName = inject(APP_SETTINGS).appName;
  private readonly router = inject(Router);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  readonly isHandset = toSignal(inject(BreakpointObserver).observe('(max-width: 767.98px)').pipe(map((state) => state.matches)), {
    initialValue: false,
  });
  readonly drawerOpen = signal(false);
  readonly isAdmin = computed(() => this.auth.hasRole('admin'));
  readonly isSeller = computed(() => this.auth.hasRole('seller', 'admin'));
  readonly search = new FormControl('', { nonNullable: true });

  constructor() {
    // After each navigation: close the drawer and move focus to the new page for screen readers.
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.drawerOpen.set(false);
      queueMicrotask(() => this.main().nativeElement.focus({ preventScroll: true }));
    });
  }

  submitSearch(): void {
    const q = this.search.value.trim();
    void this.router.navigate(['/products'], { queryParams: { q: q || null } });
  }

  skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  logout(): void {
    this.auth.logout('/');
  }
}
