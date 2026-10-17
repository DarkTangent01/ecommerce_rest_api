export interface ApiEnvelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta | Record<string, unknown>;
  details?: ApiErrorDetail[] | Record<string, unknown>;
}

export interface ApiErrorDetail {
  field?: string;
  message: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  pages: number;
  nextCursor?: string | null;
}

export interface User {
  _id: string;
  name: string;
  email: string;
  role: 'user' | 'seller' | 'admin';
  tenant?: string;
  isActive?: boolean;
  mfaEnabled?: boolean;
  createdAt?: string;
}

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  step_up_required?: boolean;
}

export interface ProductVariant {
  size?: string;
  color?: string;
  sku: string;
  price: number;
  stock: number;
}

export interface Product {
  _id: string;
  name: string;
  description?: string;
  price: number;
  size?: string;
  category?: string;
  sku?: string;
  stock: number;
  variants?: ProductVariant[];
  ratingAverage?: number;
  ratingCount?: number;
  image: string;
  seller?: string;
  isActive?: boolean;
  createdAt?: string;
}

export interface CartItem {
  product: Product | string;
  quantity: number;
}

export interface Cart {
  _id?: string;
  user?: string;
  items: CartItem[];
}

export interface ShippingAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface OrderItem {
  product: string;
  name: string;
  price: number;
  quantity: number;
}

export interface Order {
  _id: string;
  items: OrderItem[];
  subtotal?: number;
  discountTotal?: number;
  total: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refund_requested' | 'refunded';
  paymentStatus: 'unpaid' | 'authorized' | 'paid' | 'failed' | 'refunded';
  refundStatus?: 'none' | 'requested' | 'approved' | 'rejected' | 'processed';
  paymentProvider?: string;
  paymentReference?: string;
  shippingAddress: ShippingAddress;
  createdAt?: string;
}

export interface Review {
  _id: string;
  rating: number;
  title?: string;
  comment?: string;
  user?: Pick<User, 'name'>;
  createdAt?: string;
}

export interface Wishlist {
  user?: string;
  products: Product[];
}

export interface Coupon {
  _id: string;
  code: string;
  type: 'percentage' | 'fixed';
  value: number;
  maxDiscount?: number;
  minOrderTotal?: number;
  usageLimit: number;
  perUserLimit: number;
  usedCount?: number;
  startsAt?: string;
  expiresAt?: string;
  isActive: boolean;
}

export interface AdminAnalytics {
  users: number;
  products: number;
  orders: number;
  revenue: number;
  reviews: number;
}

export interface SellerDashboard {
  productCount: number;
  recentOrders: Order[];
  revenue: number;
  lowStock: Product[];
}

export interface ShipmentPayload {
  carrier: string;
  trackingNumber: string;
  trackingUrl?: string;
  status: 'pending' | 'label_created' | 'in_transit' | 'delivered' | 'failed';
}
