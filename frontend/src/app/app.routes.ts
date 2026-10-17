import { Routes } from '@angular/router';
import { AppShellComponent } from './core/layout/app-shell.component';
import { adminGuard } from './core/guards/role.guard';
import { authGuard } from './core/guards/auth.guard';
import { sellerGuard } from './core/guards/role.guard';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      { path: '', loadComponent: () => import('./features/products/home.component').then((m) => m.HomeComponent) },
      { path: 'login', loadComponent: () => import('./features/auth/login.component').then((m) => m.LoginComponent) },
      { path: 'register', loadComponent: () => import('./features/auth/register.component').then((m) => m.RegisterComponent) },
      { path: 'products', loadComponent: () => import('./features/products/product-list.component').then((m) => m.ProductListComponent) },
      { path: 'products/:id', loadComponent: () => import('./features/products/product-detail.component').then((m) => m.ProductDetailComponent) },
      { path: 'cart', canActivate: [authGuard], loadComponent: () => import('./features/cart/cart.component').then((m) => m.CartComponent) },
      { path: 'checkout', canActivate: [authGuard], loadComponent: () => import('./features/checkout/checkout.component').then((m) => m.CheckoutComponent) },
      { path: 'orders', canActivate: [authGuard], loadComponent: () => import('./features/orders/orders.component').then((m) => m.OrdersComponent) },
      { path: 'orders/:id', canActivate: [authGuard], loadComponent: () => import('./features/orders/order-detail.component').then((m) => m.OrderDetailComponent) },
      { path: 'payments/:id', canActivate: [authGuard], loadComponent: () => import('./features/payments/payment-status.component').then((m) => m.PaymentStatusComponent) },
      { path: 'profile', canActivate: [authGuard], loadComponent: () => import('./features/profile/profile.component').then((m) => m.ProfileComponent) },
      { path: 'wishlist', canActivate: [authGuard], loadComponent: () => import('./features/products/wishlist.component').then((m) => m.WishlistComponent) },
      { path: 'notifications', canActivate: [authGuard], loadComponent: () => import('./features/notifications/notifications.component').then((m) => m.NotificationsComponent) },
      { path: 'admin', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/admin-dashboard.component').then((m) => m.AdminDashboardComponent) },
      { path: 'admin/coupons', canActivate: [authGuard, adminGuard], loadComponent: () => import('./features/admin/coupon-admin.component').then((m) => m.CouponAdminComponent) },
      { path: 'seller', canActivate: [authGuard, sellerGuard], loadComponent: () => import('./features/seller/seller-dashboard.component').then((m) => m.SellerDashboardComponent) },
    ],
  },
  { path: '**', redirectTo: '' },
];
