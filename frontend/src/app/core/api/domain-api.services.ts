import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { ApiClientService, QueryValue } from './api-client.service';
import {
  AdminAnalytics,
  ApiEnvelope,
  Cart,
  Coupon,
  Order,
  Product,
  Review,
  SellerDashboard,
  ShipmentPayload,
  ShippingAddress,
  User,
  Wishlist,
} from '../../shared/models/api.models';

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly api = inject(ApiClientService);
  login(payload: { email: string; password: string }) {
    return this.api.post('/login', payload);
  }
  register(payload: { name: string; email: string; password: string; repeat_password: string }) {
    return this.api.post('/register', payload);
  }
  refresh(refresh_token: string) {
    return this.api.post('/refresh', { refresh_token });
  }
  logout(refresh_token: string) {
    return this.api.post('/logout', { refresh_token });
  }
}

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private readonly api = inject(ApiClientService);

  list(query?: Record<string, QueryValue>): Observable<ApiEnvelope<Product[]>> {
    return this.api.getEnvelope<Product[]>('/products', query);
  }

  get(id: string): Observable<Product> {
    return this.api.get<Product>(`/products/${id}`);
  }

  save(product: Partial<Product>, image?: File, id?: string): Observable<Product> {
    const form = new FormData();
    Object.entries(product).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        form.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
      }
    });
    if (image) form.append('image', image);
    return id ? this.api.put<Product>(`/products/${id}`, form) : this.api.post<Product>('/products', form);
  }

  delete(id: string): Observable<Product> {
    return this.api.delete<Product>(`/products/${id}`);
  }
}

@Injectable({ providedIn: 'root' })
export class CartApiService {
  private readonly api = inject(ApiClientService);
  get(): Observable<Cart> {
    return this.api.get<Cart>('/cart');
  }
  add(productId: string, quantity: number): Observable<Cart> {
    return this.api.post<Cart>('/cart/items', { productId, quantity });
  }
  update(productId: string, quantity: number): Observable<Cart> {
    return this.api.put<Cart>('/cart/items', { productId, quantity });
  }
  remove(productId: string): Observable<Cart> {
    return this.api.delete<Cart>(`/cart/items/${productId}`);
  }
  clear(): Observable<Cart> {
    return this.api.delete<Cart>('/cart');
  }
}

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private readonly api = inject(ApiClientService);
  checkout(payload: { shippingAddress: ShippingAddress; paymentProvider?: string; couponCode?: string }): Observable<Order> {
    return this.api.post<Order>('/orders/checkout', payload, { headers: { 'Idempotency-Key': crypto.randomUUID() } });
  }
  list(query?: Record<string, QueryValue>): Observable<ApiEnvelope<Order[]>> {
    return this.api.getEnvelope<Order[]>('/orders', query);
  }
  get(id: string): Observable<Order> {
    return this.api.get<Order>(`/orders/${id}`);
  }
  cancel(id: string, reason: string): Observable<Order> {
    return this.api.post<Order>(`/orders/${id}/cancel`, { reason });
  }
  refund(id: string, reason: string): Observable<Order> {
    return this.api.post<Order>(`/orders/${id}/refund`, { reason });
  }
}

@Injectable({ providedIn: 'root' })
export class WishlistApiService {
  private readonly api = inject(ApiClientService);
  get(): Observable<Wishlist> {
    return this.api.get<Wishlist>('/wishlist');
  }
  add(productId: string): Observable<Wishlist> {
    return this.api.post<Wishlist>(`/wishlist/${productId}`);
  }
  remove(productId: string): Observable<Wishlist> {
    return this.api.delete<Wishlist>(`/wishlist/${productId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class ReviewApiService {
  private readonly api = inject(ApiClientService);
  list(productId: string): Observable<Review[]> {
    return this.api.get<Review[]>(`/products/${productId}/reviews`);
  }
  create(productId: string, payload: { rating: number; title?: string; comment?: string }): Observable<Review> {
    return this.api.post<Review>(`/products/${productId}/reviews`, payload);
  }
}

@Injectable({ providedIn: 'root' })
export class CouponApiService {
  private readonly api = inject(ApiClientService);
  list(): Observable<Coupon[]> {
    return this.api.get<Coupon[]>('/coupons');
  }
  create(payload: Partial<Coupon>): Observable<Coupon> {
    return this.api.post<Coupon>('/coupons', payload);
  }
  update(id: string, payload: Partial<Coupon>): Observable<Coupon> {
    return this.api.put<Coupon>(`/coupons/${id}`, payload);
  }
}

@Injectable({ providedIn: 'root' })
export class AdminApiService {
  private readonly api = inject(ApiClientService);
  analytics(): Observable<AdminAnalytics> {
    return this.api.get<AdminAnalytics>('/admin/analytics');
  }
  platformEvents(): Observable<unknown[]> {
    return this.api.get<unknown[]>('/platform/events');
  }
  auditTrail(): Observable<unknown[]> {
    return this.api.get<unknown[]>('/platform/audit-trail');
  }
  securitySignals(): Observable<unknown[]> {
    return this.api.get<unknown[]>('/platform/security-signals');
  }
}

@Injectable({ providedIn: 'root' })
export class SellerApiService {
  private readonly api = inject(ApiClientService);
  dashboard(): Observable<SellerDashboard> {
    return this.api.get<SellerDashboard>('/seller/dashboard');
  }
  updateShipment(orderId: string, payload: ShipmentPayload): Observable<unknown> {
    return this.api.put<unknown>(`/orders/${orderId}/shipment`, payload);
  }
}

@Injectable({ providedIn: 'root' })
export class PaymentApiService {
  statusFromOrder(orderId: string): Observable<Pick<Order, '_id' | 'status' | 'paymentStatus' | 'total'>> {
    return inject(OrderApiService)
      .get(orderId)
      .pipe(map(({ _id, status, paymentStatus, total }) => ({ _id, status, paymentStatus, total })));
  }
}

@Injectable({ providedIn: 'root' })
export class NotificationApiService {
  readonly hasRestEndpoint = false;
}

@Injectable({ providedIn: 'root' })
export class ProfileApiService {
  private readonly api = inject(ApiClientService);
  me(): Observable<User> {
    return this.api.get<User>('/users');
  }
  exportData(): Observable<unknown> {
    return this.api.get<unknown>('/users/export');
  }
  deleteMe(): Observable<null> {
    return this.api.delete<null>('/users/me');
  }
}
