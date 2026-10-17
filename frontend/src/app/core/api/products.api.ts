import { Injectable, inject } from '@angular/core';
import { ApiClientService, type Query } from './api-client.service';
import type { Id, Product, ProductInput, ProductPageMeta, ProductQuery } from '../models';

/** GET/POST /products, GET/PUT/DELETE /products/:id. */
@Injectable({ providedIn: 'root' })
export class ProductsApi {
  private readonly api = inject(ApiClientService);

  list(query: ProductQuery = {}) {
    return this.api.getPage<Product, ProductPageMeta>('/products', query as Query);
  }

  get(id: Id) {
    return this.api.get<Product>(`/products/${encodeURIComponent(id)}`);
  }

  /** Multipart: the image is required on create. */
  create(input: ProductInput, image: File) {
    return this.api.post<Product>('/products', this.toForm(input, image), { skipErrorToast: true });
  }

  /** Multipart with the full product body (the backend validates name and price on update too). */
  update(id: Id, input: ProductInput, image?: File) {
    return this.api.put<Product>(`/products/${encodeURIComponent(id)}`, this.toForm(input, image), { skipErrorToast: true });
  }

  /** Admin only; soft-deletes the product. */
  remove(id: Id) {
    return this.api.delete<Product>(`/products/${encodeURIComponent(id)}`);
  }

  private toForm(input: ProductInput, image?: File): FormData {
    const form = new FormData();
    for (const [key, value] of Object.entries(input) as [keyof ProductInput, ProductInput[keyof ProductInput]][]) {
      if (value !== undefined && value !== null && value !== '') form.append(key, String(value));
    }
    if (image) form.append('image', image, image.name);
    return form;
  }
}
