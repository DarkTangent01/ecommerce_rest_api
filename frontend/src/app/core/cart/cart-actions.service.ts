import { Injectable, inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { Observable, EMPTY, catchError, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import type { Id } from '../models';
import { CartStore } from './cart.store';

/**
 * "Add to cart" from any page. Guests are sent to sign in first (the backend has no guest cart)
 * and come back to the same page afterwards.
 */
@Injectable({ providedIn: 'root' })
export class CartActions {
  private readonly auth = inject(AuthService);
  private readonly cart = inject(CartStore);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);

  add(productId: Id, quantity = 1): Observable<boolean> {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { returnUrl: this.router.url } });
      return EMPTY;
    }
    return this.cart.add(productId, quantity).pipe(
      map(() => {
        this.snackBar
          .open(quantity > 1 ? `Added ${quantity} to your cart` : 'Added to your cart', 'View cart', { duration: 4000, panelClass: 'toast-success' })
          .onAction()
          .subscribe(() => void this.router.navigateByUrl('/cart'));
        return true;
      }),
      // The error interceptor already told the user what went wrong (e.g. insufficient stock).
      catchError(() => EMPTY),
    );
  }
}
