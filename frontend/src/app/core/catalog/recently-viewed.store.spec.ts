import { TestBed } from '@angular/core/testing';
import { RECENTLY_VIEWED_KEY, RECENTLY_VIEWED_MAX, RecentlyViewedStore } from './recently-viewed.store';

const id = (n: number) => n.toString(16).padStart(24, '0');

describe('RecentlyViewedStore', () => {
  beforeEach(() => sessionStorage.clear());
  afterEach(() => sessionStorage.clear());

  const store = () => {
    TestBed.resetTestingModule();
    return TestBed.inject(RecentlyViewedStore);
  };

  it('keeps the newest first, without duplicates, up to the limit', () => {
    const recent = store();
    for (let n = 1; n <= RECENTLY_VIEWED_MAX + 3; n++) recent.record(id(n));
    recent.record(id(5));
    expect(recent.ids()[0]).toBe(id(5));
    expect(recent.ids()).toHaveLength(RECENTLY_VIEWED_MAX);
    expect(new Set(recent.ids()).size).toBe(RECENTLY_VIEWED_MAX);
  });

  it('survives a reload within the tab, storing ids only', () => {
    store().record(id(1));
    expect(JSON.parse(sessionStorage.getItem(RECENTLY_VIEWED_KEY)!)).toEqual([id(1)]);
    expect(store().ids()).toEqual([id(1)]);
  });

  it('ignores tampered or malformed storage', () => {
    sessionStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify([id(1), '<script>', 42, { $ne: 1 }]));
    expect(store().ids()).toEqual([id(1)]);
    sessionStorage.setItem(RECENTLY_VIEWED_KEY, '{not json');
    expect(store().ids()).toEqual([]);
  });

  it('can leave out the product being viewed', () => {
    const recent = store();
    recent.record(id(1));
    recent.record(id(2));
    expect(recent.recent(id(2))).toEqual([id(1)]);
  });
});
