import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';
import { APP_SETTINGS } from '../config/app.config';
import { contextFor, type RequestFlags } from '../http/http-context';
import type { ApiSuccess, PageMeta, Paged } from '../models';

export type QueryValue = string | number | boolean | null | undefined;
export type Query = Record<string, QueryValue>;

export interface RequestOptions extends RequestFlags {
  headers?: Record<string, string>;
}

/**
 * Thin typed wrapper over HttpClient for the backend envelope. Errors are normalized to ApiError
 * by the error interceptor, so callers only ever see `data` (or `data` + `meta` for lists).
 */
@Injectable({ providedIn: 'root' })
export class ApiClientService {
  private readonly http = inject(HttpClient);
  readonly baseUrl = inject(APP_SETTINGS).apiBaseUrl;

  get<T>(path: string, query?: Query, options?: RequestOptions): Observable<T> {
    return this.http
      .get<ApiSuccess<T>>(this.url(path), { params: this.params(query), ...this.httpOptions(options) })
      .pipe(map((res) => res.data));
  }

  /** For list endpoints that return `meta` alongside `data`. */
  getPage<T, M extends PageMeta = PageMeta>(path: string, query?: Query, options?: RequestOptions): Observable<Paged<T, M>> {
    return this.http.get<ApiSuccess<T[], M>>(this.url(path), { params: this.params(query), ...this.httpOptions(options) }).pipe(
      map((res) => ({
        items: res.data,
        meta: res.meta ?? ({ page: 1, limit: res.data.length, total: res.data.length, pages: 1 } as M),
      })),
    );
  }

  post<T>(path: string, body: unknown = {}, options?: RequestOptions): Observable<T> {
    return this.http.post<ApiSuccess<T>>(this.url(path), body, this.httpOptions(options)).pipe(map((res) => res.data));
  }

  put<T>(path: string, body: unknown = {}, options?: RequestOptions): Observable<T> {
    return this.http.put<ApiSuccess<T>>(this.url(path), body, this.httpOptions(options)).pipe(map((res) => res.data));
  }

  delete<T>(path: string, options?: RequestOptions): Observable<T> {
    return this.http.delete<ApiSuccess<T>>(this.url(path), this.httpOptions(options)).pipe(map((res) => res.data));
  }

  isApiUrl(url: string): boolean {
    return url.startsWith(`${this.baseUrl}/`) || url === this.baseUrl;
  }

  private url(path: string): string {
    return `${this.baseUrl}${path.startsWith('/') ? path : `/${path}`}`;
  }

  private params(query?: Query): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, String(value));
      }
    }
    return params;
  }

  private httpOptions(options?: RequestOptions) {
    return {
      context: contextFor(options),
      ...(options?.headers && { headers: new HttpHeaders(options.headers) }),
    };
  }
}
