import { ChangeDetectionStrategy, Component, OnDestroy, computed, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { ProductsApi } from '../../core/api/products.api';
import { AuthService } from '../../core/auth/auth.service';
import { CATEGORIES } from '../../core/config/catalog';
import { IMAGE_UPLOAD, RULES } from '../../core/config/validation';
import { ApiError } from '../../core/http/api-error';
import type { Product, ProductInput } from '../../core/models';
import { applyServerErrors, errorMessage } from '../../shared/forms/form-errors';
import { notBlank } from '../../shared/forms/validators';

/** Client-side file check; UX only (the server re-validates type, magic bytes and size). */
export const checkImage = (file: File): string | null => {
  const ext = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
  if (!(IMAGE_UPLOAD.mimeTypes as readonly string[]).includes(file.type) || !(IMAGE_UPLOAD.extensions as readonly string[]).includes(ext)) {
    return 'Use a JPG, PNG or WebP image.';
  }
  if (file.size > IMAGE_UPLOAD.maxBytes) return 'The image must be 5 MB or smaller.';
  return null;
};

/** Create/edit form for products, used by sellers and admins. */
@Component({
  selector: 'app-product-form',
  imports: [ReactiveFormsModule, MatButtonModule, MatCheckboxModule, MatFormFieldModule, MatIconModule, MatInputModule, MatSelectModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './product-form.component.html',
  styles: `
    .image {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
    }
    .preview {
      width: 96px;
      height: 96px;
      object-fit: cover;
      border-radius: 12px;
      background: var(--mat-sys-surface-container);
    }
    .file-error,
    .form-error {
      color: var(--mat-sys-error);
      margin: 4px 0;
    }
  `,
})
export class ProductFormComponent implements OnDestroy {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ProductsApi);
  private readonly auth = inject(AuthService);

  /** Existing product to edit; omit to create. */
  readonly product = input<Product | null>(null);
  readonly saved = output<Product>();
  readonly cancelled = output<void>();

  readonly rules = RULES;
  readonly accept = IMAGE_UPLOAD.accept;
  readonly categories = CATEGORIES;
  readonly errorMessage = errorMessage;
  readonly isAdmin = computed(() => this.auth.hasRole('admin'));

  readonly image = signal<File | null>(null);
  readonly preview = signal<string | null>(null);
  readonly fileError = signal<string | null>(null);
  readonly saving = signal(false);
  readonly formError = signal<string | null>(null);

  readonly form = this.fb.group({
    name: ['', [Validators.required, notBlank, Validators.minLength(RULES.product.nameMin), Validators.maxLength(RULES.product.nameMax)]],
    price: [0, [Validators.required, Validators.min(0)]],
    stock: [0, [Validators.required, Validators.min(0), Validators.max(RULES.product.stockMax), Validators.pattern(/^\d+$/)]],
    category: ['', Validators.maxLength(RULES.product.category)],
    sku: ['', Validators.maxLength(RULES.product.sku)],
    size: ['', Validators.maxLength(RULES.product.size)],
    description: ['', Validators.maxLength(RULES.product.description)],
    isActive: [true],
  });

  constructor() {
    effect(() => {
      const product = this.product();
      if (!product) return;
      this.form.reset({
        name: product.name,
        price: product.price,
        stock: product.stock,
        category: product.category ?? '',
        sku: product.sku ?? '',
        size: product.size ?? '',
        description: product.description,
        isActive: product.isActive,
      });
      this.setPreview(product.image);
    });
  }

  ngOnDestroy(): void {
    this.setPreview(null);
  }

  pickImage(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.fileError.set(null);
    if (!file) return;
    const problem = checkImage(file);
    if (problem) {
      this.fileError.set(problem);
      (event.target as HTMLInputElement).value = '';
      return;
    }
    this.image.set(file);
    this.setPreview(URL.createObjectURL(file));
  }

  submit(): void {
    this.form.markAllAsTouched();
    const editing = this.product();
    if (!editing && !this.image()) this.fileError.set('A product image is required.');
    if (this.form.invalid || this.fileError() || this.saving()) return;

    const value = this.form.getRawValue();
    const input: ProductInput = {
      name: value.name.trim(),
      price: Math.round(value.price * 100) / 100,
      stock: value.stock,
      category: value.category.trim() || undefined,
      sku: value.sku.trim() || undefined,
      size: value.size.trim() || undefined,
      description: value.description.trim(),
      // Sellers cannot change visibility; the backend ignores the field for them anyway.
      ...(this.isAdmin() && { isActive: value.isActive }),
    };

    this.saving.set(true);
    this.formError.set(null);
    const image = this.image() ?? undefined;
    const request = editing ? this.api.update(editing._id, input, image) : this.api.create(input, image!);
    request.subscribe({
      next: (product) => {
        this.saving.set(false);
        this.saved.emit(product);
      },
      error: (error: unknown) => {
        this.saving.set(false);
        const apiError = ApiError.from(error);
        if (apiError.status === 409) {
          this.form.controls.sku.setErrors({ server: 'This SKU is already used by another product.' });
          return;
        }
        const unmatched = applyServerErrors(this.form, apiError);
        this.formError.set(unmatched.length || !apiError.fieldErrors.length ? apiError.message : null);
      },
    });
  }

  private setPreview(url: string | null): void {
    const previous = this.preview();
    if (previous?.startsWith('blob:')) URL.revokeObjectURL(previous);
    this.preview.set(url);
  }
}
