import { Injectable } from '@angular/core';

const REFRESH_TOKEN_KEY = 'shop.rt';

/**
 * Token placement (the backend returns tokens in JSON; it has no HttpOnly cookie support):
 * - access token: memory only, gone on reload, never readable from storage;
 * - refresh token: sessionStorage, scoped to this tab, cleared when the tab closes, so a
 *   reload can restore the session. Script injected into the page could still read it; HttpOnly
 *   cookies on the backend would remove that exposure (listed as a backend gap).
 * Storage access is wrapped because it throws in some privacy modes.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  private access: string | null = null;

  get accessToken(): string | null {
    return this.access;
  }

  get refreshToken(): string | null {
    try {
      return sessionStorage.getItem(REFRESH_TOKEN_KEY);
    } catch {
      return null;
    }
  }

  save(accessToken: string, refreshToken: string): void {
    this.access = accessToken;
    try {
      sessionStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    } catch {
      // Without storage the session simply will not survive a reload.
    }
  }

  clear(): void {
    this.access = null;
    try {
      sessionStorage.removeItem(REFRESH_TOKEN_KEY);
    } catch {
      // Nothing to clear.
    }
  }
}
