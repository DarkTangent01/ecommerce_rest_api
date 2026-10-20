import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { CartStore, type AvailableCartLine } from '../../core/cart/cart.store';
import { RULES } from '../../core/config/validation';
import { WishlistStore } from '../../core/wishlist/wishlist.store';
import { AsyncStateComponent, type ViewState } from '../../shared/components/async-state.component';
import { ConfirmDialogComponent, type ConfirmDialogData } from '../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StockBadgeComponent } from '../../shared/components/stock-badge.component';
import { ToastService } from '../../shared/components/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-cart',
  imports: [RouterLink, MatButtonModule, MatIconModule, AsyncStateComponent, EmptyStateComponent, StockBadgeComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './cart.component.html',
  styleUrl: './cart.component.scss',
})
export class CartComponent {
  readonly cart = inject(CartStore);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly wishlist = inject(WishlistStore);

  readonly state = computed<ViewState>(() => {
    const status = this.cart.status();
    if (status === 'error') return 'error';
    return status === 'loading' && this.cart.cart().items.length === 0 ? 'loading' : 'ready';
  });
  readonly canCheckout = computed(() => !this.cart.isEmpty() && this.cart.unavailableLines().length === 0);

  constructor() {
    // Refresh on entry: stock and prices may have changed since the cart was last loaded.
    this.cart.load();
  }

  maxQuantity(line: AvailableCartLine): number {
    return Math.min(line.product.stock, RULES.cartQuantity.max);
  }

  setQuantity(line: AvailableCartLine, quantity: number): void {
    if (quantity < RULES.cartQuantity.min || quantity > this.maxQuantity(line)) return;
    this.cart.setQuantity(line.product._id, quantity).subscribe();
  }

  remove(productId: string, name: string): void {
    this.cart.remove(productId).subscribe(() => this.toast.show(`Removed ${name} from your cart.`, 'success'));
  }

  /** Saves to the wishlist first, then removes from the cart, so a failure never loses the item. */
  moveToWishlist(productId: string, name: string): void {
    this.wishlist
      .save(productId)
      .pipe(switchMap(() => this.cart.remove(productId)))
      .subscribe(() => this.toast.show(`Moved ${name} to your wishlist.`, 'success'));
  }

  removeUnavailable(): void {
    // Lines without a product carry no id the API could remove; clearing is the only option then.
    for (const line of this.cart.unavailableLines()) {
      if (line.product) this.cart.remove(line.product._id).subscribe();
    }
  }

  clear(): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: { title: 'Empty your cart?', message: 'This removes every item from your cart.', confirmLabel: 'Empty cart', destructive: true },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.cart.clear()),
      )
      .subscribe(() => this.toast.show('Your cart is empty.', 'success'));
  }
}
