import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDialog } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { RouterLink } from '@angular/router';
import { filter, switchMap } from 'rxjs';
import { ProductsApi } from '../../core/api/products.api';
import { AuthService } from '../../core/auth/auth.service';
import type { Product } from '../../core/models';
import { AsyncStateComponent } from '../../shared/components/async-state.component';
import { ConfirmDialogComponent, type ConfirmDialogData } from '../../shared/components/confirm-dialog.component';
import { EmptyStateComponent } from '../../shared/components/empty-state.component';
import { ToastService } from '../../shared/components/toast.service';
import { MoneyPipe } from '../../shared/pipes/money.pipe';
import { errorMessageOf, viewStateOf } from '../../shared/resource-state';
import { ProductFormComponent } from './product-form.component';

const PAGE_SIZE = 20;

/**
 * Product management for admins (all products) and sellers (create; edit their own, which the
 * backend enforces). Backend gap: GET /products only returns active products and cannot filter by
 * seller, so deactivated products are not listed here.
 */
@Component({
  selector: 'app-admin-products',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatPaginatorModule,
    AsyncStateComponent,
    EmptyStateComponent,
    MoneyPipe,
    ProductFormComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './admin-products.component.html',
  styleUrl: './admin.scss',
})
export class AdminProductsComponent {
  private readonly api = inject(ProductsApi);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  readonly auth = inject(AuthService);

  readonly pageSize = PAGE_SIZE;
  readonly page = signal(1);
  readonly search = new FormControl('', { nonNullable: true });
  readonly q = signal('');
  readonly products = rxResource({
    params: () => ({ page: this.page(), q: this.q() }),
    stream: ({ params }) => this.api.list({ page: params.page, limit: PAGE_SIZE, q: params.q || undefined, sortBy: 'createdAt', order: 'desc' }),
  });
  readonly state = computed(() => viewStateOf(this.products));
  readonly error = computed(() => errorMessageOf(this.products));

  /** null = closed, 'new' = create form, Product = editing. */
  readonly editing = signal<Product | 'new' | null>(null);
  readonly editingProduct = computed(() => {
    const value = this.editing();
    return value && value !== 'new' ? value : null;
  });

  applySearch(): void {
    this.page.set(1);
    this.q.set(this.search.value.trim());
  }

  changePage(event: PageEvent): void {
    this.page.set(event.pageIndex + 1);
  }

  canEdit(product: Product): boolean {
    return this.auth.hasRole('admin') || product.seller === this.auth.user()?._id;
  }

  saved(product: Product): void {
    this.toast.show(`Saved “${product.name}”.`, 'success');
    this.editing.set(null);
    this.products.reload();
  }

  remove(product: Product): void {
    this.dialog
      .open<ConfirmDialogComponent, ConfirmDialogData, boolean>(ConfirmDialogComponent, {
        data: { title: `Remove “${product.name}”?`, message: 'The product is hidden from the shop. Existing orders are not affected.', confirmLabel: 'Remove', destructive: true },
      })
      .afterClosed()
      .pipe(
        filter((confirmed) => confirmed === true),
        switchMap(() => this.api.remove(product._id)),
      )
      .subscribe(() => {
        this.toast.show(`Removed “${product.name}”.`, 'success');
        this.products.reload();
      });
  }
}
