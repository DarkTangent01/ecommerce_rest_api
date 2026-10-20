import { CurrencyPipe } from '@angular/common';
import { Pipe, PipeTransform, inject } from '@angular/core';
import { APP_SETTINGS } from '../../core/config/app.config';

/** Formats an amount the backend computed in the store currency. Formatting only, no arithmetic. */
@Pipe({ name: 'money' })
export class MoneyPipe implements PipeTransform {
  private readonly currency = inject(APP_SETTINGS).currency;
  private readonly currencyPipe = new CurrencyPipe('en-US');

  transform(value: number | null | undefined): string {
    return this.currencyPipe.transform(value ?? 0, this.currency, 'symbol', '1.2-2') ?? '';
  }
}
