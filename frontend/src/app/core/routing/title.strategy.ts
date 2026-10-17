import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { APP_SETTINGS } from '../config/app.config';

const DEFAULT_DESCRIPTION = 'Shop the catalogue, manage your cart and track your orders.';

/** Sets "<route title> | <app>" and the route's `data.description` meta tag on every navigation. */
@Injectable({ providedIn: 'root' })
export class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);
  private readonly appName = inject(APP_SETTINGS).appName;

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    this.title.setTitle(routeTitle ? `${routeTitle} | ${this.appName}` : this.appName);

    let route = snapshot.root;
    while (route.firstChild) route = route.firstChild;
    const description = (route.data['description'] as string | undefined) ?? DEFAULT_DESCRIPTION;
    this.meta.updateTag({ name: 'description', content: description });
  }

  /** For pages whose title depends on loaded data (e.g. a product name). */
  setPageTitle(title: string): void {
    this.title.setTitle(`${title} | ${this.appName}`);
  }
}
