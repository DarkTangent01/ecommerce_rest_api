import { Routes } from '@angular/router';
import { AppShellComponent } from './core/layout/app-shell.component';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { adminGuard, sellerGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        title: 'Shop',
        loadComponent: () => import('./features/products/home.component').then((m) => m.HomeComponent),
      },
      {
        path: 'products',
        title: 'Products',
        data: { description: 'Browse and search the catalogue.' },
        loadComponent: () => import('./features/products/product-list.component').then((m) => m.ProductListComponent),
      },
      {
        path: 'products/:id',
        title: 'Product',
        loadComponent: () => import('./features/products/product-detail.component').then((m) => m.ProductDetailComponent),
      },
      {
        path: 'login',
        title: 'Sign in',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent),
      },
      {
        path: 'register',
        title: 'Create account',
        canActivate: [guestGuard],
        loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent),
      },
      {
        path: 'cart',
        title: 'Cart',
        canActivate: [authGuard],
        loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent),
      },
      {
        path: 'checkout',
        title: 'Checkout',
        canActivate: [authGuard],
        loadComponent: () => import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent),
      },
      {
        path: 'checkout/complete/:id',
        title: 'Order placed',
        canActivate: [authGuard],
        loadComponent: () => import('./features/checkout/order-confirmation.component').then((m) => m.OrderConfirmationComponent),
      },
      {
        path: 'account',
        canActivate: [authGuard],
        children: [
          {
            path: '',
            title: 'Account',
            loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent),
          },
          {
            path: 'orders',
            title: 'Orders',
            loadComponent: () => import('./features/orders/orders.component').then((m) => m.OrdersComponent),
          },
          {
            path: 'orders/:id',
            title: 'Order',
            loadComponent: () => import('./features/orders/order-detail.component').then((m) => m.OrderDetailComponent),
          },
          {
            path: 'wishlist',
            title: 'Wishlist',
            loadComponent: () => import('./features/products/wishlist.component').then((m) => m.WishlistComponent),
          },
        ],
      },
      {
        path: 'seller',
        canActivate: [authGuard, sellerGuard],
        children: [
          {
            path: '',
            title: 'Seller dashboard',
            loadComponent: () => import('./features/seller/seller-dashboard.component').then((m) => m.SellerDashboardComponent),
          },
          {
            path: 'products',
            title: 'My products',
            loadComponent: () => import('./features/admin/admin-products.component').then((m) => m.AdminProductsComponent),
          },
        ],
      },
      {
        path: 'admin',
        canActivate: [authGuard, adminGuard],
        children: [
          {
            path: '',
            title: 'Admin',
            loadComponent: () => import('./features/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent),
          },
          {
            path: 'products',
            title: 'Manage products',
            loadComponent: () => import('./features/admin/admin-products.component').then((m) => m.AdminProductsComponent),
          },
          {
            path: 'orders',
            title: 'Manage orders',
            loadComponent: () => import('./features/admin/admin-orders.component').then((m) => m.AdminOrdersComponent),
          },
          {
            path: 'coupons',
            title: 'Coupons',
            loadComponent: () => import('./features/admin/coupon-admin.component').then((m) => m.CouponAdminComponent),
          },
          {
            path: 'settings',
            title: 'Store settings',
            loadComponent: () => import('./features/admin/tenant-settings.component').then((m) => m.TenantSettingsComponent),
          },
        ],
      },
      // Old URLs from the previous version of the app.
      { path: 'orders', redirectTo: 'account/orders' },
      { path: 'orders/:id', redirectTo: 'account/orders/:id' },
      { path: 'payments/:id', redirectTo: 'account/orders/:id' },
      { path: 'profile', redirectTo: 'account' },
      { path: 'wishlist', redirectTo: 'account/wishlist' },
      {
        path: 'unauthorized',
        title: 'Access denied',
        loadComponent: () => import('./features/errors/error-pages.component').then((m) => m.UnauthorizedComponent),
      },
      {
        path: '**',
        title: 'Page not found',
        loadComponent: () => import('./features/errors/error-pages.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
