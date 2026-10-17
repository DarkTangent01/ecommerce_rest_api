import type { Types } from "mongoose";

// Persisted shapes of the core domain entities. These mirror the Mongoose schemas in
// src/models and are used as the schema generics, so documents are typed end to end.

export type ObjectId = Types.ObjectId;

export type Role = "user" | "admin" | "seller";

export interface Timestamps {
  createdAt: Date;
  updatedAt: Date;
}

export interface User extends Timestamps {
  _id: ObjectId;
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  tenant: string;
  deletedAt: Date | null;
  mfaEnabled: boolean;
  mfaVerifiedAt?: Date;
}

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface ProductVariant {
  size?: string;
  color?: string;
  sku?: string;
  price?: number;
  stock: number;
}

export interface Product extends Timestamps {
  _id: ObjectId;
  name: string;
  description: string;
  /** Decimal currency units, always rounded to 2 places (see utils/money). */
  price: number;
  size?: string;
  category?: string;
  sku?: string;
  stock: number;
  variants: ProductVariant[];
  ratingAverage: number;
  ratingCount: number;
  isActive: boolean;
  seller?: ObjectId;
  tenant: string;
  deletedAt: Date | null;
  image: string;
}

export interface CartItem {
  product: ObjectId;
  quantity: number;
}

export interface Cart extends Timestamps {
  _id: ObjectId;
  user: ObjectId;
  tenant: string;
  items: CartItem[];
}

export type OrderStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "shipped"
  | "delivered"
  | "cancelled"
  | "refund_requested"
  | "refunded";

export type PaymentStatus = "unpaid" | "authorized" | "paid" | "failed" | "refunded";

export type RefundStatus = "none" | "requested" | "approved" | "rejected" | "processed";

export interface OrderItem {
  product: ObjectId;
  name: string;
  price: number;
  quantity: number;
}

export interface PaymentTransition {
  from: string;
  to: string;
  at: Date;
  reason?: string;
}

export interface Order extends Timestamps {
  _id: ObjectId;
  user: ObjectId;
  tenant: string;
  items: OrderItem[];
  total: number;
  subtotal?: number;
  discountTotal: number;
  coupon?: ObjectId;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  refundStatus: RefundStatus;
  paymentProvider?: string;
  paymentReference?: string;
  paymentStateHistory: PaymentTransition[];
  shippingAddress: Address;
  cancelledAt?: Date;
  cancellationReason?: string;
  deletedAt: Date | null;
}

/** A provider webhook event recorded for idempotent payment processing. */
export interface Payment extends Timestamps {
  _id: ObjectId;
  provider: string;
  eventId: string;
  order?: ObjectId;
  type: string;
  payloadHash: string;
  receivedAt: Date;
}

export type CouponType = "percentage" | "fixed";

export interface Coupon extends Timestamps {
  _id: ObjectId;
  code: string;
  type: CouponType;
  value: number;
  maxDiscount?: number;
  minOrderTotal: number;
  usageLimit: number;
  perUserLimit: number;
  usedCount: number;
  startsAt?: Date;
  expiresAt?: Date;
  isActive: boolean;
  tenant: string;
  deletedAt: Date | null;
  createdBy?: ObjectId;
}

export type ReservationStatus = "reserved" | "committed" | "released" | "expired";

export interface InventoryReservation extends Timestamps {
  _id: ObjectId;
  user: ObjectId;
  tenant: string;
  order?: ObjectId;
  product: ObjectId;
  variantSku?: string;
  quantity: number;
  status: ReservationStatus;
  expiresAt: Date;
}

/** The authenticated principal attached to `req.user` by the auth middleware. */
export interface AuthUser {
  _id: ObjectId;
  role: Role;
  email: string;
  name: string;
  tenant: string;
}
