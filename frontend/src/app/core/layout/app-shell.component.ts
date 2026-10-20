import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, signal, viewChild } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatDividerModule } from '@angular/material/divider';
import { MatIconModule } from '@angular/material/icon';
import { MatListModule } from '@angular/material/list';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter, map, startWith } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { CartStore } from '../cart/cart.store';
import { CATEGORIES } from '../config/catalog';
import { LoadingService } from '../loading/loading.service';
import { LogoComponent } from '../../shared/ui/logo.component';
import { SearchBoxComponent } from './search-box.component';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatSidenavModule,
    MatListModule,
    MatDividerModule,
    MatProgressBarModule,
    LogoComponent,
    SearchBoxComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app-shell.component.html',
  styleUrl: './app-shell.component.scss',
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartStore);
  readonly loading = inject(LoadingService);
  private readonly router = inject(Router);
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  readonly categories = CATEGORIES;
  readonly year = new Date().getFullYear();
  readonly drawerOpen = signal(false);
  readonly isAdmin = computed(() => this.auth.hasRole('admin'));
  readonly isSeller = computed(() => this.auth.hasRole('seller', 'admin'));
  readonly firstName = computed(() => this.auth.user()?.name.split(/\s+/)[0] ?? '');
  readonly cartLabel = computed(() => {
    const count = this.cart.count();
    return `Cart, ${count} ${count === 1 ? 'item' : 'items'}`;
  });

  private readonly navigations = this.router.events.pipe(filter((event) => event instanceof NavigationEnd));
  /** Highlights the category tab while browsing that category. */
  readonly activeCategory = toSignal(
    this.navigations.pipe(
      startWith(null),
      map(() => {
        const tree = this.router.parseUrl(this.router.url);
        const onProducts = tree.root.children['primary']?.segments.map((s) => s.path).join('/') === 'products';
        return onProducts ? ((tree.queryParams['category'] as string | undefined) ?? null) : null;
      }),
    ),
    { initialValue: null },
  );

  constructor() {
    // After each navigation: close the drawer and move focus to the new page for screen readers.
    this.navigations.pipe(takeUntilDestroyed()).subscribe(() => {
      this.drawerOpen.set(false);
      queueMicrotask(() => this.main().nativeElement.focus({ preventScroll: true }));
    });
  }

  skipToContent(event: Event): void {
    event.preventDefault();
    this.main().nativeElement.focus();
  }

  logout(): void {
    this.auth.logout('/');
  }
}
