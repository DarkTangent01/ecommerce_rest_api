import { Component, computed, inject, signal, ChangeDetectionStrategy } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import {
  LucideHeart,
  LucideLayoutDashboard,
  LucideLogOut,
  LucideMenu,
  LucidePackage,
  LucideSearch,
  LucideShoppingBag,
  LucideShoppingCart,
  LucideUserRound,
  LucideX,
} from '@lucide/angular';
import { AuthService } from '../auth/auth.service';
import { ToastComponent } from '../../shared/components/toast.component';
import { CartStateService } from '../cart/cart-state.service';

@Component({
  selector: 'app-shell',
  imports: [
    RouterOutlet,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    ToastComponent,
    LucideMenu,
    LucideX,
    LucideShoppingBag,
    LucideShoppingCart,
    LucideHeart,
    LucideUserRound,
    LucideLayoutDashboard,
    LucidePackage,
    LucideLogOut,
    LucideSearch,
  ],
  changeDetection: ChangeDetectionStrategy.Eager,
  template: `
    <header class="topbar">
      <div class="topbar-main">
        <a routerLink="/" class="brand">
          <span class="brand-mark">S</span>
          <span>ShopSphere</span>
        </a>
        <form class="global-search" (ngSubmit)="search()">
          <select name="category" [(ngModel)]="category">
            <option value="">All</option>
            @for (item of categories; track item) {
              <option [value]="item">{{ item }}</option>
            }
          </select>
          <input name="searchTerm" [(ngModel)]="searchTerm" placeholder="Search for products, brands and more" />
          <button type="submit" aria-label="Search"><svg lucideSearch></svg></button>
        </form>
      </div>
      <div class="topbar-actions">
        <a class="desktop-link" routerLink="/products" routerLinkActive="active">Shop</a>
        <a class="desktop-link" routerLink="/orders" routerLinkActive="active">Orders</a>
        @if (auth.isAuthenticated()) {
          <a class="icon-link" routerLink="/wishlist" aria-label="Wishlist"><svg lucideHeart></svg></a>
          <a class="icon-link cart-link" routerLink="/cart" aria-label="Cart"><svg lucideShoppingCart></svg><span>{{ cart.count() }}</span></a>
          <a class="account-link" routerLink="/profile" aria-label="Profile"><svg lucideUserRound></svg><span>{{ auth.user()?.name || 'Account' }}</span></a>
          <button class="icon-button" type="button" (click)="auth.logout()" aria-label="Logout"><svg lucideLogOut></svg></button>
        } @else {
          <a class="button ghost" routerLink="/login">Log in</a>
          <a class="button primary" routerLink="/register">Sign up</a>
        }
        <button class="icon-button mobile-only" type="button" (click)="menuOpen.set(!menuOpen())" aria-label="Menu">
          @if (menuOpen()) { <svg lucideX></svg> } @else { <svg lucideMenu></svg> }
        </button>
      </div>
    </header>

    @if (menuOpen()) {
      <aside class="mobile-drawer">
        <a routerLink="/products" (click)="menuOpen.set(false)"><svg lucideShoppingBag></svg> Products</a>
        <a routerLink="/cart" (click)="menuOpen.set(false)"><svg lucideShoppingCart></svg> Cart</a>
        <a routerLink="/wishlist" (click)="menuOpen.set(false)"><svg lucideHeart></svg> Wishlist</a>
        <a routerLink="/orders" (click)="menuOpen.set(false)"><svg lucidePackage></svg> Orders</a>
        @if (isSeller()) { <a routerLink="/seller" (click)="menuOpen.set(false)"><svg lucideLayoutDashboard></svg> Seller</a> }
        @if (isAdmin()) { <a routerLink="/admin" (click)="menuOpen.set(false)"><svg lucideLayoutDashboard></svg> Admin</a> }
      </aside>
    }

    <main>
      <router-outlet />
    </main>
    <app-toast-host />
  `,
})
export class AppShellComponent {
  readonly auth = inject(AuthService);
  readonly cart = inject(CartStateService);
  private readonly router = inject(Router);
  readonly menuOpen = signal(false);
  readonly isAdmin = computed(() => this.auth.role() === 'admin');
  readonly isSeller = computed(() => ['seller', 'admin'].includes(this.auth.role()));
  readonly categories = ['Fashion', 'Electronics', 'Home', 'Beauty', 'Sports'];
  searchTerm = '';
  category = '';

  constructor() {
    if (this.auth.isAuthenticated()) {
      this.auth.loadProfile().subscribe();
      this.cart.load();
    }
  }

  search(): void {
    void this.router.navigate(['/products'], {
      queryParams: {
        q: this.searchTerm || null,
        category: this.category || null,
      },
    });
  }
}
