import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { AuthService } from '../auth/auth.service';
import type { Role } from '../models';
import { AppShellComponent } from './app-shell.component';
import { API, aCart, aProduct, aUser, envelope, testProviders } from '../../../testing/test-helpers';

describe('AppShellComponent', () => {
  let fixture: ComponentFixture<AppShellComponent>;
  let http: HttpTestingController;

  const setup = async (role: Role | null) => {
    TestBed.configureTestingModule({
      imports: [AppShellComponent],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting(), ...testProviders()],
    });
    http = TestBed.inject(HttpTestingController);
    if (role) {
      const auth = TestBed.inject(AuthService);
      auth.user.set(aUser({ role, name: 'Ada Lovelace' }));
      auth.status.set('authenticated');
    }
    fixture = TestBed.createComponent(AppShellComponent);
    await fixture.whenStable();
    for (const req of http.match(`${API}/cart`)) req.flush(envelope(aCart([{ product: aProduct(), quantity: 2 }])));
    for (const req of http.match(`${API}/wishlist`)) req.flush(envelope({ _id: 'w1', user: 'u1', products: [] }));
    await fixture.whenStable();
  };

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const linkTexts = () => [...el().querySelectorAll('.catbar a')].map((a) => a.textContent?.trim());

  it('shows the live cart count in the cart link name and greets the shopper', async () => {
    await setup('user');
    expect(el().querySelector('a.cart')?.getAttribute('aria-label')).toBe('Cart, 2 items');
    expect(el().querySelector('.cart-count')?.textContent?.trim()).toBe('2');
    expect(el().querySelector('button[aria-label="Account menu"]')?.textContent).toContain('Hello, Ada');
  });

  it('never shows seller or admin navigation to a customer', async () => {
    await setup('user');
    expect(linkTexts()).not.toContain('Admin');
    expect(linkTexts()).not.toContain('Seller hub');
  });

  it('shows the seller hub to sellers and both areas to admins', async () => {
    await setup('seller');
    expect(linkTexts()).toContain('Seller hub');
    expect(linkTexts()).not.toContain('Admin');
    TestBed.resetTestingModule();
    await setup('admin');
    expect(linkTexts()).toEqual(expect.arrayContaining(['Seller hub', 'Admin']));
  });

  it('offers sign-in to guests', async () => {
    await setup(null);
    const signIn = el().querySelector<HTMLAnchorElement>('a.account');
    expect(signIn?.getAttribute('href')).toBe('/login');
    expect(el().querySelector('a.cart')?.getAttribute('aria-label')).toBe('Cart, 0 items');
  });

  it('links every category in the category bar', async () => {
    await setup(null);
    expect(linkTexts()).toEqual(['All products', 'Kitchen', 'Apparel', 'Electronics', 'Home', 'Outdoors']);
  });
});
