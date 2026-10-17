// Request bodies and query parameters, mirroring the backend's Zod schemas
// (src/validators/*.ts). Field limits live in core/config/validation.ts.
import type { Address, CouponType, Id, ShipmentStatus } from './domain';

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
  repeat_password: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface CartItemRequest {
  productId: Id;
  quantity: number;
}

/** POST /orders/checkout. Prices and totals are never sent; the server computes them. */
export interface CheckoutRequest {
  shippingAddress: Address;
  paymentProvider?: string;
  couponCode?: string;
}

export interface ReasonRequest {
  reason: string;
}

export interface ReviewRequest {
  rating: number;
  title?: string;
  comment?: string;
}

export type ProductSortField = 'name' | 'price' | 'createdAt' | 'stock';
export type SortOrder = 'asc' | 'desc';

/** Query parameters accepted by GET /products. */
export interface ProductQuery {
  page?: number;
  limit?: number;
  q?: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: ProductSortField;
  order?: SortOrder;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}

/** Product fields sent as multipart form fields to POST/PUT /products. */
export interface ProductInput {
  name: string;
  price: number;
  description?: string;
  category?: string;
  sku?: string;
  size?: string;
  stock: number;
  /** Honoured for admins only; sellers' writes ignore it server-side. */
  isActive?: boolean;
}

export interface CouponRequest {
  code: string;
  type: CouponType;
  value: number;
  maxDiscount?: number;
  minOrderTotal: number;
  usageLimit: number;
  perUserLimit: number;
  startsAt?: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface ShipmentRequest {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  status: ShipmentStatus;
}

export interface TenantRequest {
  name: string;
  status?: 'active' | 'suspended';
  config?: { currency?: string; locale?: string; paymentProvider?: string };
}
