import { Injectable, computed, inject, signal } from '@angular/core';
import { CartApiService } from '../api/domain-api.services';
import { Cart, Product } from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class CartStateService {
  private readonly api = inject(CartApiService);
  readonly cart = signal<Cart>({ items: [] });
  readonly count = computed(() => this.cart().items.reduce((sum, item) => sum + item.quantity, 0));
  readonly subtotal = computed(() =>
    this.cart().items.reduce((sum, item) => {
      const product = this.productOf(item.product);
      return sum + product.price * item.quantity;
    }, 0),
  );

  load(): void {
    this.api.get().subscribe({ next: (cart) => this.cart.set(cart), error: () => this.cart.set({ items: [] }) });
  }

  set(cart: Cart): void {
    this.cart.set(cart);
  }

  productOf(product: Product | string): Product {
    return typeof product === 'string' ? ({ _id: product, name: 'Product', price: 0, stock: 0, image: '' } as Product) : product;
  }
}
