import { Injectable, signal } from '@angular/core';

export interface ToastMessage {
  id: number;
  tone: 'success' | 'error' | 'info';
  text: string;
}

@Injectable({ providedIn: 'root' })
export class ToastService {
  readonly messages = signal<ToastMessage[]>([]);
  private id = 0;

  show(text: string, tone: ToastMessage['tone'] = 'info'): void {
    const toast = { id: ++this.id, tone, text };
    this.messages.update((items) => [...items, toast]);
    window.setTimeout(() => this.dismiss(toast.id), 4500);
  }

  dismiss(id: number): void {
    this.messages.update((items) => items.filter((item) => item.id !== id));
  }
}
