import { Injectable, signal } from '@angular/core';
import type { Id } from '../models';

export const RECENTLY_VIEWED_KEY = 'as.recentlyViewed';
export const RECENTLY_VIEWED_MAX = 12;

/**
 * Product ids the shopper opened in this tab, newest first. Only ids are kept (no prices or other
 * data that could go stale), in sessionStorage like the rest of the app's client state, so nothing
 * survives the tab. Storage failures (private mode, quota) just mean an empty history.
 */
@Injectable({ providedIn: 'root' })
export class RecentlyViewedStore {
  readonly ids = signal<Id[]>(this.read());

  record(id: Id): void {
    const next = [id, ...this.ids().filter((existing) => existing !== id)].slice(0, RECENTLY_VIEWED_MAX);
    this.ids.set(next);
    this.write(next);
  }

  /** Recent ids, optionally without the product being viewed right now. */
  recent(except?: Id): Id[] {
    return this.ids().filter((id) => id !== except);
  }

  clear(): void {
    this.ids.set([]);
    this.write([]);
  }

  private read(): Id[] {
    try {
      const parsed: unknown = JSON.parse(sessionStorage.getItem(RECENTLY_VIEWED_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter((id): id is Id => typeof id === 'string' && /^[0-9a-f]{24}$/i.test(id)).slice(0, RECENTLY_VIEWED_MAX) : [];
    } catch {
      return [];
    }
  }

  private write(ids: Id[]): void {
    try {
      sessionStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(ids));
    } catch {
      // Storage unavailable: keep the in-memory history only.
    }
  }
}
