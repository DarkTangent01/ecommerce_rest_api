import { Injectable, inject } from '@angular/core';
import { ApiClientService } from './api-client.service';
import type { Cart, Order, Review, User, Wishlist } from '../models';

export interface AccountExport {
  user: User | null;
  orders: Order[];
  cart: Cart | null;
  wishlist: Wishlist | null;
  reviews: Review[];
}

/** GET /users/export and DELETE /users/me (GDPR). Profile reads go through AuthApi.me(). */
@Injectable({ providedIn: 'root' })
export class AccountApi {
  private readonly api = inject(ApiClientService);

  exportData() {
    return this.api.get<AccountExport>('/users/export');
  }

  /** Requires a non-risky session (step-up); soft-deletes and anonymises the account. */
  deleteAccount() {
    return this.api.delete<null>('/users/me', { skipErrorToast: true });
  }
}
