import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { RouterLink } from '@angular/router';
import { CartActions } from '../../core/cart/cart-actions.service';
import { WishlistStore } from '../../core/wishlist/wishlist.store';
import { AsyncStateComponent, type ViewState } from '../../shared/components/async-state.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { StockBadgeComponent } from '../../shared/components/stock-badge.component';
import { MoneyPipe } from '../../shared/pipes/money.pipe';

@Component({
  selector: 'app-wishlist',
  imports: [RouterLink, MatButtonModule, MatIconModule, AsyncStateComponent, EmptyStateComponent, StockBadgeComponent, MoneyPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './wishlist.component.html',
  styleUrl: './wishlist.component.scss',
})
export class WishlistComponent {
  readonly wishlist = inject(WishlistStore);
  private readonly cartActions = inject(CartActions);
  readonly state = computed<ViewState>(() => {
    const status = this.wishlist.status();
    if (status === 'error') return 'error';
    return status === 'loading' && !this.wishlist.products().length ? 'loading' : 'ready';
  });

  constructor() {
    this.wishlist.load();
  }

  moveToCart(productId: string): void {
    this.cartActions.add(productId).subscribe();
  }

  remove(productId: string): void {
    this.wishlist.toggle(productId).subscribe();
  }
}
