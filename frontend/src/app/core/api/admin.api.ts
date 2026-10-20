import { Injectable, inject } from '@angular/core';
import { ApiClientService, type Query } from './api-client.service';
import type {
  AdminAnalytics,
  AuditLogEntry,
  Coupon,
  CouponRequest,
  DomainEvent,
  Id,
  PageQuery,
  SecuritySignal,
  SellerDashboard,
  Tenant,
  TenantRequest,
} from '../models';

/** Admin-only endpoints: analytics, coupons, tenant settings and platform read models. */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(ApiClientService);

  analytics() {
    return this.api.get<AdminAnalytics>('/admin/analytics');
  }

  coupons(query: PageQuery = {}) {
    return this.api.getPage<Coupon>('/coupons', query as Query);
  }

  createCoupon(body: CouponRequest) {
    return this.api.post<Coupon>('/coupons', body, { skipErrorToast: true });
  }

  /** The backend validates the full coupon body on update. */
  updateCoupon(id: Id, body: CouponRequest) {
    return this.api.put<Coupon>(`/coupons/${encodeURIComponent(id)}`, body, { skipErrorToast: true });
  }

  tenant() {
    return this.api.get<Tenant>('/tenant');
  }

  updateTenant(body: TenantRequest) {
    return this.api.put<Tenant>('/tenant', body, { skipErrorToast: true });
  }

  /** Last 100 entries each. */
  events() {
    return this.api.get<DomainEvent[]>('/platform/events');
  }

  securitySignals() {
    return this.api.get<SecuritySignal[]>('/platform/security-signals');
  }

  auditTrail() {
    return this.api.get<AuditLogEntry[]>('/platform/audit-trail');
  }
}

/** GET /seller/dashboard (seller or admin). */
@Injectable({ providedIn: 'root' })
export class SellerApi {
  private readonly api = inject(ApiClientService);

  dashboard() {
    return this.api.get<SellerDashboard>('/seller/dashboard');
  }
}
