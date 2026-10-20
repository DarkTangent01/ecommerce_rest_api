import type { ParamMap } from '@angular/router';
import { PAGE_SIZES } from '../../core/config/catalog';
import type { ProductQuery, ProductSortField, SortOrder } from '../../core/models';

export interface SortOption {
  value: string;
  label: string;
  sortBy: ProductSortField;
  order: SortOrder;
}

/** Sort fields the backend allow-lists for GET /products (rating sort is not supported). */
export const SORT_OPTIONS: SortOption[] = [
  { value: 'createdAt:desc', label: 'Newest', sortBy: 'createdAt', order: 'desc' },
  { value: 'price:asc', label: 'Price: low to high', sortBy: 'price', order: 'asc' },
  { value: 'price:desc', label: 'Price: high to low', sortBy: 'price', order: 'desc' },
  { value: 'name:asc', label: 'Name: A to Z', sortBy: 'name', order: 'asc' },
];

const toNumber = (value: string | null, { min = 0, integer = false } = {}): number | undefined => {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < min) return undefined;
  return integer ? Math.floor(parsed) : parsed;
};

/** URL query string -> sanitized API query (unknown or invalid values fall back to defaults). */
export const parseProductQuery = (params: ParamMap): Required<Pick<ProductQuery, 'page' | 'limit' | 'sortBy' | 'order'>> & ProductQuery => {
  const sort = SORT_OPTIONS.find((option) => option.sortBy === params.get('sortBy') && option.order === (params.get('order') ?? 'desc')) ?? SORT_OPTIONS[0]!;
  const limit = toNumber(params.get('limit'), { min: 1, integer: true });
  return {
    page: toNumber(params.get('page'), { min: 1, integer: true }) ?? 1,
    limit: PAGE_SIZES.find((size) => size === limit) ?? PAGE_SIZES[0],
    q: params.get('q')?.trim().slice(0, 100) || undefined,
    category: params.get('category')?.trim() || undefined,
    minPrice: toNumber(params.get('minPrice')),
    maxPrice: toNumber(params.get('maxPrice')),
    sortBy: sort.sortBy,
    order: sort.order,
  };
};
