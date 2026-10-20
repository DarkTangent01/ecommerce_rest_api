import type { Provider } from '@angular/core';
import { ToastService } from '../app/shared/components/toast.service';
import { APP_SETTINGS, type AppSettings } from '../app/core/config/app.config';
import type { Cart, Order, Product, User } from '../app/core/models';

export const API = '/api/v1';

export const testSettings: AppSettings = { apiBaseUrl: API, tenantId: 'acme', currency: 'USD', appName: 'ShopSphere' };

export interface ToastSpy {
  show: ReturnType<typeof vi.fn>;
}

/** Common providers: deterministic settings and a toast spy instead of Material snack bars. */
export const testProviders = (toast: ToastSpy = { show: vi.fn() }): Provider[] => [
  { provide: APP_SETTINGS, useValue: testSettings },
  { provide: ToastService, useValue: toast },
];

export const envelope = <T>(data: T, meta?: unknown) => ({ success: true, message: 'OK', data, error: null, ...(meta ? { meta } : {}) });

export const failure = (code: string, message: string, details?: unknown) => ({
  success: false,
  message,
  data: null,
  error: { code, message, ...(details ? { details } : {}) },
});

export const aUser = (overrides: Partial<User> = {}): User => ({
  _id: 'u1',
  name: 'Ada Buyer',
  email: 'ada@example.com',
  role: 'user',
  isActive: true,
  tenant: 'acme',
  deletedAt: null,
  mfaEnabled: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

export const aProduct = (overrides: Partial<Product> = {}): Product => ({
  _id: 'p1',
  name: 'Ceramic Mug',
  description: 'Holds coffee.',
  price: 12.5,
  stock: 5,
  variants: [],
  ratingAverage: 4.2,
  ratingCount: 3,
  isActive: true,
  tenant: 'acme',
  deletedAt: null,
  image: 'http://localhost:5000/uploads/mug.jpg',
  createdAt: '2026-01-01T00:00:00.000Z',
  category: 'kitchen',
  ...overrides,
});

export const aCart = (lines: { product: Product; quantity: number }[]): Cart => ({
  _id: 'c1',
  user: 'u1',
  items: lines.map(({ product, quantity }) => ({
    product: { _id: product._id, name: product.name, price: product.price, image: product.image, stock: product.stock, isActive: product.isActive },
    quantity,
  })),
});

export const anOrder = (overrides: Partial<Order> = {}): Order => ({
  _id: 'o1234567890',
  user: 'u1',
  tenant: 'acme',
  items: [{ product: 'p1', name: 'Ceramic Mug', price: 12.5, quantity: 2 }],
  subtotal: 25,
  discountTotal: 0,
  total: 25,
  status: 'pending',
  paymentStatus: 'unpaid',
  refundStatus: 'none',
  paymentStateHistory: [],
  shippingAddress: { line1: '1 Road', city: 'London', state: 'London', postalCode: 'NW1', country: 'UK' },
  createdAt: '2026-01-02T00:00:00.000Z',
  updatedAt: '2026-01-02T00:00:00.000Z',
  ...overrides,
});
