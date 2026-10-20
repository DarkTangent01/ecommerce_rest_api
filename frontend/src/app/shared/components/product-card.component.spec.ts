import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import type { Product } from '../../core/models';
import { ProductCardComponent } from './product-card.component';
import { aProduct, testProviders } from '../../../testing/test-helpers';

describe('ProductCardComponent', () => {
  let fixture: ComponentFixture<ProductCardComponent>;

  const render = async (product: Product, saved = false) => {
    fixture.componentRef.setInput('product', product);
    fixture.componentRef.setInput('saved', saved);
    await fixture.whenStable();
  };
  const el = () => fixture.nativeElement as HTMLElement;

  beforeEach(() => {
    TestBed.configureTestingModule({ imports: [ProductCardComponent], providers: [provideRouter([]), ...testProviders()] });
    fixture = TestBed.createComponent(ProductCardComponent);
  });

  it('shows the name, price and a link to the product', async () => {
    await render(aProduct({ _id: 'p9', name: 'Desk Lamp', price: 49.5 }));
    const link = el().querySelector<HTMLAnchorElement>('h3 a')!;
    expect(link.textContent).toContain('Desk Lamp');
    expect(link.getAttribute('href')).toBe('/products/p9');
    expect(el().textContent).toContain('$49.50');
  });

  it('badges low stock and out-of-stock products from the real stock value, and invents no discounts', async () => {
    await render(aProduct({ stock: 3 }));
    expect(el().querySelector('.badge')?.textContent).toContain('Only 3 left');
    expect(el().textContent).not.toMatch(/% off|was \$/i);

    await render(aProduct({ stock: 0, name: 'Wool Throw' }));
    expect(el().querySelector('.badge')?.textContent).toContain('Out of stock');
    const add = el().querySelector<HTMLButtonElement>('button.add')!;
    expect(add.disabled).toBe(true);
    expect(add.getAttribute('aria-label')).toBe('Wool Throw is out of stock');

    await render(aProduct({ stock: 50 }));
    expect(el().querySelector('.badge')).toBeNull();
  });

  it('emits add-to-cart and wishlist events without navigating', async () => {
    const product = aProduct({ name: 'Ceramic Mug' });
    await render(product);
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    const added = vi.fn();
    const toggled = vi.fn();
    fixture.componentInstance.addToCart.subscribe(added);
    fixture.componentInstance.toggleWishlist.subscribe(toggled);

    el().querySelector<HTMLButtonElement>('button[aria-label="Add Ceramic Mug to cart"]')!.click();
    el().querySelector<HTMLButtonElement>('button[aria-label="Save Ceramic Mug to wishlist"]')!.click();

    expect(added).toHaveBeenCalledWith(product);
    expect(toggled).toHaveBeenCalledWith(product);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('reflects the saved state for assistive technology', async () => {
    await render(aProduct({ name: 'Ceramic Mug' }), true);
    const wish = el().querySelector<HTMLButtonElement>('button.wish')!;
    expect(wish.getAttribute('aria-pressed')).toBe('true');
    expect(wish.getAttribute('aria-label')).toBe('Remove Ceramic Mug from wishlist');
  });

  it('falls back to a placeholder when the image fails to load', async () => {
    await render(aProduct());
    el().querySelector('img')!.dispatchEvent(new Event('error'));
    await fixture.whenStable();
    expect(el().querySelector('img')).toBeNull();
    expect(el().querySelector('.fallback')).not.toBeNull();
  });
});
