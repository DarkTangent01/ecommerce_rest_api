// Typed API services, one per backend resource.
export { ApiClientService, type Query, type RequestOptions } from './api-client.service';
export { AuthApi } from './auth.api';
export { ProductsApi } from './products.api';
export { CartApi } from './cart.api';
export { OrdersApi } from './orders.api';
export { ReviewsApi, WishlistApi } from './catalog-extras.api';
export { AccountApi, type AccountExport } from './account.api';
export { AdminApi, SellerApi } from './admin.api';
