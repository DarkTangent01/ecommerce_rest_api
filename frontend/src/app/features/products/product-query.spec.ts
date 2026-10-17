import { convertToParamMap } from '@angular/router';
import { parseProductQuery } from './product-query';

describe('parseProductQuery', () => {
  it('applies defaults', () => {
    expect(parseProductQuery(convertToParamMap({}))).toEqual({
      page: 1,
      limit: 12,
      q: undefined,
      category: undefined,
      minPrice: undefined,
      maxPrice: undefined,
      sortBy: 'createdAt',
      order: 'desc',
    });
  });

  it('keeps valid values from the URL', () => {
    const query = parseProductQuery(convertToParamMap({ page: '3', limit: '24', q: ' mug ', category: 'kitchen', minPrice: '5', maxPrice: '20.5', sortBy: 'price', order: 'asc' }));
    expect(query).toEqual({ page: 3, limit: 24, q: 'mug', category: 'kitchen', minPrice: 5, maxPrice: 20.5, sortBy: 'price', order: 'asc' });
  });

  it('drops values the backend would reject or ignore', () => {
    const query = parseProductQuery(convertToParamMap({ page: '-2', limit: '5000', minPrice: 'abc', maxPrice: '-1', sortBy: 'ratingAverage', order: 'sideways' }));
    expect(query).toMatchObject({ page: 1, limit: 12, minPrice: undefined, maxPrice: undefined, sortBy: 'createdAt', order: 'desc' });
  });

  it('caps search length like the backend', () => {
    expect(parseProductQuery(convertToParamMap({ q: 'x'.repeat(150) })).q).toHaveLength(100);
  });
});
