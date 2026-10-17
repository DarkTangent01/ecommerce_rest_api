import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { map, Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { ApiEnvelope } from '../../shared/models/api.models';

export type QueryValue = string | number | boolean | null | undefined;

@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = environment.apiBaseUrl.replace(/\/$/, '');

  get<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.http.get<ApiEnvelope<T>>(this.url(path), { params: this.params(query) }).pipe(map((res) => res.data));
  }

  getEnvelope<T>(path: string, query?: Record<string, QueryValue>): Observable<ApiEnvelope<T>> {
    return this.http.get<ApiEnvelope<T>>(this.url(path), { params: this.params(query) });
  }

  post<T>(path: string, body?: unknown, options?: { headers?: Record<string, string> }): Observable<T> {
    return this.http.post<ApiEnvelope<T>>(this.url(path), body ?? {}, options).pipe(map((res) => res.data));
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<ApiEnvelope<T>>(this.url(path), body ?? {}).pipe(map((res) => res.data));
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<ApiEnvelope<T>>(this.url(path)).pipe(map((res) => res.data));
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private params(query?: Record<string, QueryValue>): HttpParams {
    let params = new HttpParams();
    Object.entries(query ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    });
    return params;
  }
}
