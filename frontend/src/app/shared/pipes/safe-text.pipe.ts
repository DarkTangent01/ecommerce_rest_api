import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'safeText' })
export class SafeTextPipe implements PipeTransform {
  transform(value: unknown): string {
    return String(value ?? '').replace(/[<>]/g, '');
  }
}
