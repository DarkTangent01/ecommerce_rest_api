import { InjectionToken } from '@angular/core';
import { environment } from '../../../environments/environment';

export interface AppSettings {
  apiBaseUrl: string;
  tenantId: string;
  currency: string;
  appName: string;
}

/** Runtime settings; injectable so tests can override them. */
export const APP_SETTINGS = new InjectionToken<AppSettings>('APP_SETTINGS', {
  providedIn: 'root',
  factory: () => ({
    apiBaseUrl: environment.apiBaseUrl.replace(/\/$/, ''),
    tenantId: environment.tenantId,
    currency: environment.currency,
    appName: 'AeroScript',
  }),
});
