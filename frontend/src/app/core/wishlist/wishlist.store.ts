import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, EMPTY, tap } from 'rxjs';
import { WishlistApi } from '../api/catalog-extras.api';
import { AuthService } from '../auth/auth.service';
import type { Id, Wishlist, WishlistProduct } from '../models';
import type { LoadState } from '../cart/cart.store';

/** Signed-in user's wishlist; loads on sign-in so product cards can show the saved state. */
@Injectable({ providedIn: 'root' })
export class WishlistStore {
  private readonly api = inject(WishlistApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly products = signal<WishlistProduct[]>([]);
  readonly status = signal<LoadState>('idle');
  readonly ids = computed(() => new Set(this.products().map((product) => product._id)));

  constructor() {
    effect(() => {
      const signedIn = this.auth.isAuthenticated();
      untracked(() => (signedIn ? this.load() : this.reset()));
    });
  }

  has(productId: Id): boolean {
    return this.ids().has(productId);
  }

  load(): void {
    this.status.set('loading');
    this.api.get().subscribe({
      next: (wishlist) => this.adopt(wishlist),
      error: () => this.status.set('error'),
    });
  }

  toggle(productId: Id): Observable<Wishlist> {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return EMPTY;
    }
    const request = this.has(productId) ? this.api.remove(productId) : this.api.add(productId);
    return request.pipe(tap((wishlist) => this.adopt(wishlist)));
  }

  /** Idempotent add (the API's $addToSet), unlike toggle(): saving an already-saved product keeps it. */
  save(productId: Id): Observable<Wishlist> {
    return this.api.add(productId).pipe(tap((wishlist) => this.adopt(wishlist)));
  }

  reset(): void {
    this.products.set([]);
    this.status.set('idle');
  }

  private adopt(wishlist: Wishlist): void {
    this.products.set(wishlist.products);
    this.status.set('ready');
  }
}
