import { Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { Observable, finalize, tap } from 'rxjs';
import { CartApi } from '../api/cart.api';
import { AuthService } from '../auth/auth.service';
import type { Cart, CartLine, CartProduct, Id } from '../models';

export type LoadState = 'idle' | 'loading' | 'ready' | 'error';

export type AvailableCartLine = CartLine & { product: CartProduct };

const EMPTY_CART: Cart = { items: [] };

/**
 * Server-backed cart state. The backend has no guest cart, so the store only exists for signed-in
 * users: it loads on sign-in and resets on sign-out. Every mutation replaces the state with the
 * cart the server returns; nothing is computed optimistically.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly api = inject(CartApi);
  private readonly auth = inject(AuthService);

  readonly cart = signal<Cart>(EMPTY_CART);
  readonly status = signal<LoadState>('idle');
  /** Product ids with a mutation in flight, so their controls can be disabled. */
  readonly busy = signal<ReadonlySet<Id>>(new Set());

  readonly lines = computed(() => this.cart().items.filter((line): line is AvailableCartLine => line.product !== null));
  /** Lines whose product was deleted or deactivated; checkout would reject them. */
  readonly unavailableLines = computed(() => this.cart().items.filter((line) => !line.product || !line.product.isActive));
  readonly count = computed(() => this.lines().reduce((sum, line) => sum + line.quantity, 0));
  readonly isEmpty = computed(() => this.lines().length === 0);

  /**
   * Display-only estimate (unit price x quantity in cents). The cart API returns no totals and
   * coupons are only evaluated at checkout, so the payable amount is whatever POST /orders/checkout
   * returns. Never sent to the server.
   */
  readonly estimatedSubtotal = computed(
    () => this.lines().reduce((cents, line) => cents + Math.round(line.product.price * 100) * line.quantity, 0) / 100,
  );

  constructor() {
    effect(() => {
      const signedIn = this.auth.isAuthenticated();
      untracked(() => (signedIn ? this.load() : this.reset()));
    });
  }

  load(): void {
    this.status.set('loading');
    this.api.get().subscribe({
      next: (cart) => {
        this.cart.set(cart);
        this.status.set('ready');
      },
      error: () => this.status.set('error'),
    });
  }

  add(productId: Id, quantity = 1): Observable<Cart> {
    return this.mutate(productId, this.api.add({ productId, quantity }));
  }

  setQuantity(productId: Id, quantity: number): Observable<Cart> {
    return this.mutate(productId, this.api.update({ productId, quantity }));
  }

  remove(productId: Id): Observable<Cart> {
    return this.mutate(productId, this.api.remove(productId));
  }

  clear(): Observable<Cart> {
    return this.api.clear().pipe(tap((cart) => this.cart.set(cart)));
  }

  isBusy(productId: Id): boolean {
    return this.busy().has(productId);
  }

  reset(): void {
    this.cart.set(EMPTY_CART);
    this.status.set('idle');
  }

  private mutate(productId: Id, request: Observable<Cart>): Observable<Cart> {
    this.busy.update((ids) => new Set(ids).add(productId));
    return request.pipe(
      tap((cart) => {
        this.cart.set(cart);
        this.status.set('ready');
      }),
      finalize(() =>
        this.busy.update((ids) => {
          const next = new Set(ids);
          next.delete(productId);
          return next;
        }),
      ),
    );
  }
}
