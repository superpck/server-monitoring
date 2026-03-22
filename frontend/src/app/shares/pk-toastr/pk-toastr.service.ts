import { Injectable, signal } from '@angular/core';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
  title?: string;
  duration: number;
}

@Injectable({ providedIn: 'root' })
export class PkToastrService {
  private nextId = 0;
  readonly toasts = signal<Toast[]>([]);

  success(message: string, title?: string, duration = 4000): void {
    this.add({ type: 'success', message, title, duration });
  }

  error(message: string, title?: string, duration = 6000): void {
    this.add({ type: 'error', message, title, duration });
  }

  warning(message: string, title?: string, duration = 5000): void {
    this.add({ type: 'warning', message, title, duration });
  }

  info(message: string, title?: string, duration = 4000): void {
    this.add({ type: 'info', message, title, duration });
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private add(opts: Omit<Toast, 'id'>): void {
    const id = ++this.nextId;
    this.toasts.update((list) => [...list, { id, ...opts }]);
    if (opts.duration > 0) {
      setTimeout(() => this.dismiss(id), opts.duration);
    }
  }
}
