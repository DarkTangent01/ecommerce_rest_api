import type { Resource } from '@angular/core';
import { ApiError } from '../core/http/api-error';
import type { ViewState } from './components/async-state.component';

/** Collapses a resource's status into what <app-async-state> renders (reloads keep showing data). */
export const viewStateOf = (resource: Resource<unknown>): ViewState => {
  if (resource.status() === 'error') return 'error';
  if (resource.isLoading() && !resource.hasValue()) return 'loading';
  return 'ready';
};

export const errorMessageOf = (resource: Resource<unknown>): string | null => (resource.error() ? ApiError.from(resource.error()).message : null);
