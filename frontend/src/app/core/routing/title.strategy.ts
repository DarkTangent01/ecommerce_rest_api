import { DOCUMENT } from '@angular/common';
import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { ActivatedRouteSnapshot, RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { APP_SETTINGS } from '../config/app.config';

export const DEFAULT_DESCRIPTION = 'AeroScript: discover products, compare prices and check out securely.';
const DESCRIPTION_MAX = 160;

export interface PageMeta {
  title: string;
  description?: string;
  image?: string;
  type?: 'website' | 'product';
}

/**
 * Title and metadata for every navigation: "<route title> | AeroScript", the route's
 * `data.description`, a canonical URL, Open Graph / Twitter tags, and `noindex` for private areas
 * (routes with `data.robots`, inherited by child routes of account, seller and admin). Pages whose
 * metadata depends on loaded data (a product) call setPageMeta. No user data ever goes in here.
 */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly document = inject(DOCUMENT);
  private readonly appName = inject(APP_SETTINGS).appName;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const leaf = this.leaf(snapshot.root);
    const routeTitle = this.buildTitle(snapshot);
    this.apply({
      title: routeTitle ? `${routeTitle} | ${this.appName}` : this.appName,
      description: (leaf.data['description'] as string | undefined) ?? DEFAULT_DESCRIPTION,
      type: 'website',
    });
    this.setRobots(this.robotsFor(leaf));
    this.setCanonical(snapshot.url);
  }

  /** For pages whose title depends on loaded data (e.g. a product name). */
  setPageTitle(title: string): void {
    this.title.setTitle(`${title} | ${this.appName}`);
  }

  /** Data-driven page metadata, e.g. from a loaded product. */
  setPageMeta(page: PageMeta): void {
    this.apply({ ...page, title: `${page.title} | ${this.appName}` });
  }

  private apply({ title, description = DEFAULT_DESCRIPTION, image, type = 'website' }: PageMeta): void {
    const text = this.clip(description);
    this.title.setTitle(title);
    this.meta.updateTag({ name: 'description', content: text });
    this.meta.updateTag({ property: 'og:site_name', content: this.appName });
    this.meta.updateTag({ property: 'og:title', content: title });
    this.meta.updateTag({ property: 'og:description', content: text });
    this.meta.updateTag({ property: 'og:type', content: type });
    this.meta.updateTag({ name: 'twitter:card', content: image ? 'summary_large_image' : 'summary' });
    if (image) {
      this.meta.updateTag({ property: 'og:image', content: new URL(image, this.document.location.origin).href });
    } else {
      this.meta.removeTag("property='og:image'");
    }
  }

  private robotsFor(leaf: ActivatedRouteSnapshot): string {
    return (leaf.data['robots'] as string | undefined) ?? 'index, follow';
  }

  private setRobots(content: string): void {
    this.meta.updateTag({ name: 'robots', content });
  }

  /** Canonical: the path without query parameters, except the category of a listing. */
  private setCanonical(url: string): void {
    const parsed = new URL(url, this.document.location.origin);
    const canonical = new URL(parsed.pathname, parsed.origin);
    const category = parsed.searchParams.get('category');
    if (parsed.pathname === '/products' && category) canonical.searchParams.set('category', category);

    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.rel = 'canonical';
      this.document.head.appendChild(link);
    }
    link.href = canonical.href;
    this.meta.updateTag({ property: 'og:url', content: canonical.href });
  }

  private leaf(route: ActivatedRouteSnapshot): ActivatedRouteSnapshot {
    let current = route;
    while (current.firstChild) current = current.firstChild;
    return current;
  }

  private clip(text: string): string {
    const flat = text.replace(/\s+/g, ' ').trim();
    return flat.length > DESCRIPTION_MAX ? `${flat.slice(0, DESCRIPTION_MAX - 1).trimEnd()}…` : flat;
  }
}
