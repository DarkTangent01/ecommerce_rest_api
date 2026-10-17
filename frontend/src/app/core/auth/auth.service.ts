import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, tap } from 'rxjs';
import { ApiClientService } from '../api/api-client.service';
import { AuthTokens, User } from '../../shared/models/api.models';

const ACCESS_TOKEN_KEY = 'commerce_access_token';
const REFRESH_TOKEN_KEY = 'commerce_refresh_token';
const USER_KEY = 'commerce_user';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiClientService);
  private readonly router = inject(Router);
  private readonly accessTokenState = signal<string | null>(sessionStorage.getItem(ACCESS_TOKEN_KEY));
  readonly user = signal<User | null>(this.readUser());
  readonly isAuthenticated = computed(() => Boolean(this.accessTokenState()));
  readonly role = computed(() => this.user()?.role ?? 'user');
  stepUpRequired = signal(false);

  accessToken(): string | null {
    return this.accessTokenState();
  }

  refreshToken(): string | null {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  }

  login(payload: { email: string; password: string }): Observable<AuthTokens> {
    return this.api.post<AuthTokens>('/login', payload).pipe(
      tap((tokens) => {
        this.setTokens(tokens);
        this.stepUpRequired.set(Boolean(tokens.step_up_required));
      }),
    );
  }

  register(payload: { name: string; email: string; password: string; repeat_password: string }): Observable<AuthTokens> {
    return this.api.post<AuthTokens>('/register', payload).pipe(tap((tokens) => this.setTokens(tokens)));
  }

  loadProfile(): Observable<User> {
    return this.api.get<User>('/users').pipe(tap((user) => this.setUser(user)));
  }

  refresh(): Observable<AuthTokens> {
    const refresh_token = this.refreshToken();
    return this.api.post<AuthTokens>('/refresh', { refresh_token }).pipe(tap((tokens) => this.setTokens(tokens)));
  }

  logout(redirect = true): void {
    const refresh_token = this.refreshToken();
    if (refresh_token && this.accessToken()) {
      this.api.post<null>('/logout', { refresh_token }).subscribe({ error: () => undefined });
    }
    this.clearSession();
    if (redirect) {
      void this.router.navigateByUrl('/login');
    }
  }

  clearSession(): void {
    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    this.accessTokenState.set(null);
    this.user.set(null);
    this.stepUpRequired.set(false);
  }

  private setTokens(tokens: AuthTokens): void {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, tokens.access_token);
    sessionStorage.setItem(REFRESH_TOKEN_KEY, tokens.refresh_token);
    this.accessTokenState.set(tokens.access_token);
  }

  private setUser(user: User): void {
    sessionStorage.setItem(USER_KEY, JSON.stringify(user));
    this.user.set(user);
  }

  private readUser(): User | null {
    const raw = sessionStorage.getItem(USER_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as User;
    } catch {
      return null;
    }
  }
}
