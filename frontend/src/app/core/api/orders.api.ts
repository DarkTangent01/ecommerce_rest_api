import { Injectable, inject } from '@angular/core';
import { ApiClientService, type Query } from './api-client.service';
import type { CheckoutRequest, Id, Order, PageQuery, ReasonRequest, Shipment, ShipmentRequest } from '../models';

/** /orders, /orders/checkout, /orders/:id(/cancel|/refund|/shipment). */
@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly api = inject(ApiClientService);

  /**
   * The idempotency key must be stable across retries of the *same* checkout attempt, so the
   * caller creates it once per attempt (see CheckoutComponent) and reuses it on retry.
   */
  checkout(body: CheckoutRequest, idempotencyKey: string) {
    return this.api.post<Order>('/orders/checkout', body, { headers: { 'Idempotency-Key': idempotencyKey }, skipErrorToast: true });
  }

  /** The user's own orders; admins get every order in their tenant. */
  list(query: PageQuery = {}) {
    return this.api.getPage<Order>('/orders', query as Query);
  }

  get(id: Id) {
    return this.api.get<Order>(`/orders/${encodeURIComponent(id)}`);
  }

  cancel(id: Id, body: ReasonRequest) {
    return this.api.post<Order>(`/orders/${encodeURIComponent(id)}/cancel`, body, { skipErrorToast: true });
  }

  requestRefund(id: Id, body: ReasonRequest) {
    return this.api.post<Order>(`/orders/${encodeURIComponent(id)}/refund`, body, { skipErrorToast: true });
  }

  /** Seller (own items) or admin. */
  upsertShipment(id: Id, body: ShipmentRequest) {
    return this.api.put<Shipment>(`/orders/${encodeURIComponent(id)}/shipment`, body, { skipErrorToast: true });
  }
}
