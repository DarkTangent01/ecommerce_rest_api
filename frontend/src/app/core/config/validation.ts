// Field rules copied from the backend's Zod schemas (src/validators/*.ts) so forms reject what the
// API would reject, with the same limits. The server stays the authority; these are UX only.

export const RULES = {
  name: { min: 2, max: 80 },
  email: { max: 254 },
  password: {
    min: 8,
    max: 72,
    pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/,
    patternMessage: 'Use upper and lower case letters and at least one number.',
  },
  loginPassword: { max: 72 },
  cartQuantity: { min: 1, max: 999 },
  address: { line1: 160, line2: 160, city: 80, state: 80, postalCode: 20, country: 80 },
  couponCode: { max: 40 },
  reason: { max: 300 },
  review: { title: 120, comment: 2000 },
  product: { nameMin: 2, nameMax: 160, description: 3000, size: 30, category: 80, sku: 80, stockMax: 1_000_000 },
  shipment: { carrier: 80, trackingNumber: 120, trackingUrl: 500 },
  coupon: { code: 40 },
  tenant: { name: 120, locale: 20, paymentProvider: 80 },
} as const;

/** Upload constraints mirroring productController (multer filter + magic-byte check) and UPLOAD_MAX_BYTES. */
export const IMAGE_UPLOAD = {
  maxBytes: 5 * 1024 * 1024,
  mimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  extensions: ['.jpg', '.jpeg', '.png', '.webp'],
  accept: '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp',
} as const;

/** The backend requires Idempotency-Key values between 16 and 120 characters. */
export const IDEMPOTENCY_KEY_LENGTH = { min: 16, max: 120 } as const;

export const MAX_PAGE_SIZE = 100;
