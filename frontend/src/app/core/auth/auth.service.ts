import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, finalize, firstValueFrom, map, shareReplay, switchMap, tap, throwError } from 'rxjs';
import { AuthApi } from '../api/auth.api';
import { ApiError } from '../http/api-error';
import type { AuthTokens, LoginRequest, RegisterRequest, Role, User } from '../models';
import { TokenStorage } from './token-storage';

export type AuthStatus = 'initializing' | 'authenticated' | 'anonymous';

/**
 * Signal-based auth state. The role shown in the UI comes from GET /users (the database), never
 * from decoding the token, and the UI only *hides* privileged features: the backend enforces them.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly tokens = inject(TokenStorage);
  private readonly router = inject(Router);
  private refreshInFlight$: Observable<string> | null = null;

  readonly user = signal<User | null>(null);
  readonly status = signal<AuthStatus>('initializing');
  /** Set when the backend flagged the login as risky; sensitive actions will be refused. */
  readonly stepUpRequired = signal(false);
  readonly isAuthenticated = computed(() => this.status() === 'authenticated');
  readonly role = computed<Role | null>(() => this.user()?.role ?? null);

  /** Restores the session from the tab's refresh token. Runs once at startup, before routing. */
  async init(): Promise<void> {
    if (!this.tokens.refreshToken) {
      this.status.set('anonymous');
      return;
    }
    try {
      await firstValueFrom(this.refreshAccessToken().pipe(switchMap(() => this.loadProfile())));
    } catch {
      this.clearSession();
    }
  }

  login(body: LoginRequest): Observable<User> {
    return this.api.login(body).pipe(
      tap((result) => {
        this.tokens.save(result.access_token, result.refresh_token);
        this.stepUpRequired.set(result.step_up_required);
      }),
      switchMap(() => this.loadProfile()),
    );
  }

  register(body: RegisterRequest): Observable<User> {
    return this.api.register(body).pipe(
      tap((tokens) => this.saveTokens(tokens)),
      switchMap(() => this.loadProfile()),
    );
  }

  loadProfile(): Observable<User> {
    return this.api.me().pipe(
      tap((user) => {
        this.user.set(user);
        this.status.set('authenticated');
      }),
    );
  }

  accessToken(): string | null {
    return this.tokens.accessToken;
  }

  /**
   * Exchanges the refresh token for a new pair. Single-flight: refresh tokens are one-time use
   * (rotated by the backend), so concurrent 401s must share one refresh instead of racing.
   */
  refreshAccessToken(): Observable<string> {
    const refreshToken = this.tokens.refreshToken;
    if (!refreshToken) {
      return throwError(() => new ApiError(401, 'UNAUTHORIZED', 'Your session has expired. Please sign in again.'));
    }
    this.refreshInFlight$ ??= this.api.refresh(refreshToken).pipe(
      tap((tokens) => this.saveTokens(tokens)),
      map((tokens) => tokens.access_token),
      finalize(() => (this.refreshInFlight$ = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.refreshInFlight$;
  }

  /** Signs out locally at once and revokes the refresh token on the server in the background. */
  logout(redirectTo: string | null = '/'): void {
    const refreshToken = this.tokens.refreshToken;
    if (refreshToken && this.tokens.accessToken) {
      this.api.logout(refreshToken).subscribe({ error: () => undefined });
    }
    this.clearSession();
    if (redirectTo !== null) void this.router.navigateByUrl(redirectTo);
  }

  /** Called when a refresh fails: the session cannot be recovered. */
  sessionExpired(returnUrl: string): void {
    this.clearSession();
    void this.router.navigate(['/login'], { queryParams: { returnUrl, reason: 'expired' } });
  }

  clearSession(): void {
    this.tokens.clear();
    this.user.set(null);
    this.stepUpRequired.set(false);
    this.status.set('anonymous');
  }

  hasRole(...roles: Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  private saveTokens(tokens: AuthTokens): void {
    this.tokens.save(tokens.access_token, tokens.refresh_token);
  }
}
