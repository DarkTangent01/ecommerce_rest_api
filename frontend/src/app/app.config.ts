import { ApplicationConfig, inject, provideAppInitializer, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient, withInterceptors, withXhr } from '@angular/common/http';
import { MAT_FORM_FIELD_DEFAULT_OPTIONS } from '@angular/material/form-field';
import { MatIconRegistry } from '@angular/material/icon';
import { TitleStrategy, provideRouter, withComponentInputBinding, withInMemoryScrolling } from '@angular/router';

import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { errorInterceptor } from './core/interceptors/error.interceptor';
import { loadingInterceptor } from './core/interceptors/loading.interceptor';
import { AppTitleStrategy } from './core/routing/title.strategy';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' })),
    { provide: TitleStrategy, useExisting: AppTitleStrategy },
    // Outermost first: loading wraps everything, errors are normalized after the auth retry.
    provideHttpClient(withXhr(), withInterceptors([loadingInterceptor, errorInterceptor, authInterceptor])),
    { provide: MAT_FORM_FIELD_DEFAULT_OPTIONS, useValue: { appearance: 'outline', subscriptSizing: 'dynamic' } },
    provideAppInitializer(() => {
      inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
    }),
    // Restore the session before the first navigation so guards see the real auth state.
    provideAppInitializer(() => inject(AuthService).init()),
  ],
};
