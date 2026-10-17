import { Injectable, inject } from '@angular/core';
import { ApiClientService } from './api-client.service';
import type { Cart, CartItemRequest, Id } from '../models';

/** /cart and /cart/items. Only product ids and quantities are ever sent. */
@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly api = inject(ApiClientService);

  get() {
    return this.api.get<Cart>('/cart', undefined, { skipLoading: true });
  }

  /** Adds `quantity` to the line (creating it if needed). */
  add(body: CartItemRequest) {
    return this.api.post<Cart>('/cart/items', body);
  }

  /** Sets the line's quantity. */
  update(body: CartItemRequest) {
    return this.api.put<Cart>('/cart/items', body);
  }

  remove(productId: Id) {
    return this.api.delete<Cart>(`/cart/items/${encodeURIComponent(productId)}`);
  }

  clear() {
    return this.api.delete<Cart>('/cart');
  }
}
