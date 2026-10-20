import { Injectable, inject } from '@angular/core';
import { ApiClientService } from './api-client.service';
import type { AuthTokens, LoginRequest, LoginResult, RegisterRequest, User } from '../models';

/** POST /register, /login, /refresh, /logout; GET /users. */
@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly api = inject(ApiClientService);

  // Forms show validation errors inline, so these skip the global error toast.
  register(body: RegisterRequest) {
    return this.api.post<AuthTokens>('/register', body, { skipAuth: true, skipErrorToast: true });
  }

  login(body: LoginRequest) {
    return this.api.post<LoginResult>('/login', body, { skipAuth: true, skipErrorToast: true });
  }

  refresh(refreshToken: string) {
    return this.api.post<AuthTokens>('/refresh', { refresh_token: refreshToken }, { skipAuth: true, skipErrorToast: true, skipLoading: true });
  }

  logout(refreshToken: string) {
    return this.api.post<null>('/logout', { refresh_token: refreshToken }, { skipErrorToast: true, skipLoading: true });
  }

  me() {
    return this.api.get<User>('/users');
  }
}
