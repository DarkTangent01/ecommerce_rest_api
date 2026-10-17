import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { errorInterceptor } from '../../core/interceptors/error.interceptor';
import { LoginComponent } from './login.component';
import { API, aUser, envelope, failure, testProviders } from '../../../testing/test-helpers';

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [provideRouter([]), provideHttpClient(withInterceptors([errorInterceptor])), provideHttpClientTesting(), ...testProviders()],
    });
    http = TestBed.inject(HttpTestingController);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    fixture = TestBed.createComponent(LoginComponent);
    await fixture.whenStable();
  });

  afterEach(() => http.verify());

  const el = () => fixture.nativeElement as HTMLElement;
  const type = (selector: string, value: string) => {
    const input = el().querySelector<HTMLInputElement>(selector)!;
    input.value = value;
    input.dispatchEvent(new Event('input'));
  };
  const submit = async () => {
    el().querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await fixture.whenStable();
  };

  it('shows field errors instead of submitting an invalid form', async () => {
    type('input[type=email]', 'not-an-email');
    await submit();
    expect(el().textContent).toContain('Enter a valid email address.');
    expect(el().textContent).toContain('Password is required.');
    http.expectNone(`${API}/login`);
  });

  it('signs in and returns to the page the user came from', async () => {
    fixture.componentRef.setInput('returnUrl', '/checkout');
    type('input[type=email]', 'ada@example.com');
    type('input[autocomplete=current-password]', 'Password123');
    await submit();

    const req = http.expectOne(`${API}/login`);
    expect(req.request.body).toEqual({ email: 'ada@example.com', password: 'Password123' });
    req.flush(envelope({ access_token: 'a', refresh_token: 'r', step_up_required: false }));
    http.expectOne(`${API}/users`).flush(envelope(aUser()));

    expect(navigate).toHaveBeenCalledWith('/checkout');
  });

  it('ignores external return URLs (open redirect)', async () => {
    fixture.componentRef.setInput('returnUrl', '//evil.example/phish');
    type('input[type=email]', 'ada@example.com');
    type('input[autocomplete=current-password]', 'Password123');
    await submit();
    http.expectOne(`${API}/login`).flush(envelope({ access_token: 'a', refresh_token: 'r', step_up_required: false }));
    http.expectOne(`${API}/users`).flush(envelope(aUser()));
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows one generic message for bad credentials', async () => {
    type('input[type=email]', 'ada@example.com');
    type('input[autocomplete=current-password]', 'wrong');
    await submit();
    http.expectOne(`${API}/login`).flush(failure('UNAUTHORIZED', 'Username or Password is wrong!'), { status: 401, statusText: 'Unauthorized' });
    await fixture.whenStable();
    expect(el().querySelector('[role=alert]')?.textContent).toContain('Email or password is incorrect.');
  });
});
