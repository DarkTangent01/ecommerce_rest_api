import { inject } from '@angular/core';
import { CartActions } from '../../core/cart/cart-actions.service';
import type { Product } from '../../core/models';
import { WishlistStore } from '../../core/wishlist/wishlist.store';

/** Shared card handlers for pages that render product grids. */
export abstract class ProductGridPage {
  protected readonly cartActions = inject(CartActions);
  readonly wishlist = inject(WishlistStore);

  addToCart(product: Product): void {
    this.cartActions.add(product._id).subscribe();
  }

  toggleWishlist(product: Product): void {
    this.wishlist.toggle(product._id).subscribe();
  }
}
