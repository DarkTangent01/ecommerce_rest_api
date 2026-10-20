import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Meta, Title } from '@angular/platform-browser';
import { provideRouter, Router, TitleStrategy } from '@angular/router';
import { AppTitleStrategy } from './title.strategy';
import { testProviders } from '../../../testing/test-helpers';

@Component({ template: '' })
class BlankComponent {}

describe('AppTitleStrategy', () => {
  let router: Router;
  let meta: Meta;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...testProviders(),
        { provide: TitleStrategy, useExisting: AppTitleStrategy },
        provideRouter([
          { path: 'products', title: 'Products', data: { description: 'Browse the catalogue.' }, component: BlankComponent },
          {
            path: 'account',
            data: { robots: 'noindex, nofollow' },
            children: [{ path: 'orders', title: 'Orders', component: BlankComponent }],
          },
        ]),
      ],
    });
    router = TestBed.inject(Router);
    meta = TestBed.inject(Meta);
  });

  const canonical = () => document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]')?.getAttribute('href');

  it('sets the title, description and Open Graph tags for a route', async () => {
    await router.navigateByUrl('/products');
    expect(TestBed.inject(Title).getTitle()).toBe('Products | AeroScript');
    expect(meta.getTag('name="description"')?.content).toBe('Browse the catalogue.');
    expect(meta.getTag('property="og:title"')?.content).toBe('Products | AeroScript');
    expect(meta.getTag('name="robots"')?.content).toBe('index, follow');
  });

  it('keeps private areas out of search engines, including child routes', async () => {
    await router.navigateByUrl('/account/orders');
    expect(meta.getTag('name="robots"')?.content).toBe('noindex, nofollow');
  });

  it('canonicalises listings to the category and drops other parameters', async () => {
    await router.navigateByUrl('/products?category=kitchen&page=3&q=mug&sortBy=price');
    expect(canonical()).toBe(`${location.origin}/products?category=kitchen`);
    await router.navigateByUrl('/products?q=private-search');
    expect(canonical()).toBe(`${location.origin}/products`);
  });

  it('builds product metadata from product data, with an absolute image and a clipped description', () => {
    TestBed.inject(AppTitleStrategy).setPageMeta({ title: 'Desk Lamp', description: 'x'.repeat(300), image: '/uploads/lamp.png', type: 'product' });
    expect(TestBed.inject(Title).getTitle()).toBe('Desk Lamp | AeroScript');
    expect(meta.getTag('property="og:type"')?.content).toBe('product');
    expect(meta.getTag('property="og:image"')?.content).toBe(`${location.origin}/uploads/lamp.png`);
    expect(meta.getTag('name="description"')?.content.length).toBeLessThanOrEqual(160);
  });
});
