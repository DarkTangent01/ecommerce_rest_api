/**
 * Category shortcuts for navigation and filters.
 *
 * Backend gap: categories are free-text on each product and there is no endpoint that lists
 * them, so this list is configured here. Filtering itself is server-side (`?category=`), so a
 * category missing from this list is still reachable via search.
 */
export const CATEGORIES: readonly { value: string; label: string; icon: string }[] = [
  { value: 'kitchen', label: 'Kitchen', icon: 'coffee' },
  { value: 'apparel', label: 'Apparel', icon: 'checkroom' },
  { value: 'electronics', label: 'Electronics', icon: 'headphones' },
  { value: 'home', label: 'Home', icon: 'chair' },
  { value: 'outdoors', label: 'Outdoors', icon: 'landscape' },
];

export const PAGE_SIZES = [12, 24, 48] as const;
