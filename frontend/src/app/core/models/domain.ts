// Domain types as the backend serializes them (ObjectIds and Dates become strings in JSON).
// Mirrors src/types/domain.ts and src/models/*.ts in the API repo; keep the two in sync.

export type Id = string;
/** ISO-8601 timestamp. */
export type IsoDate = string;

export type Role = 'user' | 'admin' | 'seller';

/** GET /users. The backend strips `password` and `__v`. */
export interface User {
  _id: Id;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  tenant: string;
  deletedAt: IsoDate | null;
  mfaEnabled: boolean;
  mfaVerifiedAt?: IsoDate;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

/** POST /register and POST /refresh. */
export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

/** POST /login. */
export interface LoginResult extends AuthTokens {
  step_up_required: boolean;
}

export interface ProductVariant {
  _id?: Id;
  size?: string;
  color?: string;
  sku?: string;
  price?: number;
  stock: number;
}

/** GET /products, GET /products/:id. `image` is an absolute URL built by the backend. */
export interface Product {
  _id: Id;
  name: string;
  description: string;
  /** Decimal currency units, rounded to 2 places by the backend. */
  price: number;
  size?: string;
  category?: string;
  sku?: string;
  stock: number;
  variants: ProductVariant[];
  ratingAverage: number;
  ratingCount: number;
  isActive: boolean;
  seller?: Id;
  tenant: string;
  deletedAt: IsoDate | null;
  image: string;
  createdAt: IsoDate;
}

/** The product fields the cart endpoints populate (`name price image stock isActive`). */
export type CartProduct = Pick<Product, '_id' | 'name' | 'price' | 'image' | 'stock' | 'isActive'>;

export interface CartLine {
  /** Null if the product was removed from the database after it was added. */
  product: CartProduct | null;
  quantity: number;
}

/**
 * GET/POST/PUT/DELETE /cart*. An empty cart may come back without `_id`
 * (`{ user, items: [] }`) and DELETE /cart returns just `{ items: [] }`.
 */
export interface Cart {
  _id?: Id;
  user?: Id;
  tenant?: string;
  items: CartLine[];
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refund_requested' | 'refunded';

export type PaymentStatus = 'unpaid' | 'authorized' | 'paid' | 'failed' | 'refunded';

export type RefundStatus = 'none' | 'requested' | 'approved' | 'rejected' | 'processed';

export interface OrderItem {
  product: Id;
  name: string;
  price: number;
  quantity: number;
}

export interface PaymentTransition {
  _id?: Id;
  from: string;
  to: string;
  at: IsoDate;
  reason?: string;
}

/** All money fields are computed by the backend; the client only displays them. */
export interface Order {
  _id: Id;
  user: Id;
  tenant: string;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  discountTotal: number;
  coupon?: Id;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  deliveredAt?: string;
  refundRequestedAt?: string;
  paymentProvider?: string;
  paymentReference?: string;
  paymentStateHistory: PaymentTransition[];
  shippingAddress: Address;
  cancelledAt?: IsoDate;
  cancellationReason?: string;
  createdAt: IsoDate;
  updatedAt: IsoDate;
}

export interface Review {
  _id: Id;
  /** Populated with `name` by GET /products/:id/reviews; a bare id in the POST response. */
  user: { _id: Id; name: string } | Id;
  tenant: string;
  product: Id;
  rating: number;
  title?: string;
  comment?: string;
  status: 'published' | 'hidden' | 'flagged';
  createdAt: IsoDate;
}

/** The product fields wishlist endpoints populate. */
export type WishlistProduct = Pick<Product, '_id' | 'name' | 'price' | 'image' | 'stock' | 'ratingAverage' | 'ratingCount'>;

export interface Wishlist {
  _id?: Id;
  user: Id;
  products: WishlistProduct[];
}

export type CouponType = 'percentage' | 'fixed';

export interface Coupon {
  _id: Id;
  code: string;
  type: CouponType;
  value: number;
  maxDiscount?: number;
  minOrderTotal: number;
  usageLimit: number;
  perUserLimit: number;
  usedCount: number;
  startsAt?: IsoDate;
  expiresAt?: IsoDate;
  isActive: boolean;
  tenant: string;
  createdAt: IsoDate;
}

export type ShipmentStatus = 'pending' | 'label_created' | 'in_transit' | 'delivered' | 'failed';

export interface Shipment {
  _id: Id;
  order: Id;
  tenant: string;
  carrier?: string;
  trackingNumber?: string;
  trackingUrl?: string;
  status: ShipmentStatus;
  updatedAt: IsoDate;
}

/** GET /admin/analytics (scoped to the admin's tenant). */
export interface AdminAnalytics {
  users: number;
  products: number;
  orders: number;
  revenue: number;
  reviews: number;
}

/**
 * An order as a seller sees it: only the seller's own lines, and the delivery address only while a
 * paid order is still to be shipped. No customer id, totals or payment history.
 */
export interface SellerOrderSummary extends Pick<Order, '_id' | 'status' | 'paymentStatus' | 'createdAt'> {
  items: Pick<OrderItem, 'product' | 'name' | 'price' | 'quantity'>[];
  sellerSubtotal: number;
  shippingAddress?: Order['shippingAddress'];
}

/** GET /seller/dashboard. */
export interface SellerDashboard {
  productCount: number;
  recentOrders: SellerOrderSummary[];
  revenue: number;
  lowStock: Pick<Product, '_id' | 'name' | 'stock' | 'price' | 'ratingAverage' | 'ratingCount'>[];
}

/** GET /tenant returns the stored tenant, or `{ key, status: 'implicit' }` if none exists. */
export interface Tenant {
  _id?: Id;
  key: string;
  name?: string;
  status: 'active' | 'suspended' | 'implicit';
  config?: { currency: string; locale: string; paymentProvider: string };
}

export interface DomainEvent {
  _id: Id;
  type: string;
  aggregateType: string;
  aggregateId?: Id;
  status: 'pending' | 'processed' | 'failed';
  createdAt: IsoDate;
}

export interface SecuritySignal {
  _id: Id;
  type: string;
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical';
  user?: Id;
  ip?: string;
  createdAt: IsoDate;
}

export interface AuditLogEntry {
  _id: Id;
  sequence: number;
  action: string;
  actor?: Id | null;
  ip?: string | null;
  createdAt: IsoDate;
}
