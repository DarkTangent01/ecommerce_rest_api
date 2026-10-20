import { Injectable, inject } from '@angular/core';
import { ApiClientService, type Query } from './api-client.service';
import type { Id, PageQuery, Review, ReviewRequest, Wishlist } from '../models';

/** GET/POST /products/:id/reviews. */
@Injectable({ providedIn: 'root' })
export class ReviewsApi {
  private readonly api = inject(ApiClientService);

  list(productId: Id, query: PageQuery = {}) {
    return this.api.getPage<Review>(`/products/${encodeURIComponent(productId)}/reviews`, query as Query);
  }

  /** Only verified purchasers may review (403 otherwise). */
  create(productId: Id, body: ReviewRequest) {
    return this.api.post<Review>(`/products/${encodeURIComponent(productId)}/reviews`, body, { skipErrorToast: true });
  }
}

/** /wishlist and /wishlist/:productId. */
@Injectable({ providedIn: 'root' })
export class WishlistApi {
  private readonly api = inject(ApiClientService);

  get() {
    return this.api.get<Wishlist>('/wishlist');
  }

  add(productId: Id) {
    return this.api.post<Wishlist>(`/wishlist/${encodeURIComponent(productId)}`);
  }

  remove(productId: Id) {
    return this.api.delete<Wishlist>(`/wishlist/${encodeURIComponent(productId)}`);
  }
}
