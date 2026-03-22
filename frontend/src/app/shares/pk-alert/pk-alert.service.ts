import { Injectable, signal } from '@angular/core';

export type AlertType = 'success' | 'warning' | 'info' | 'error' | 'confirm' | 'input';

export interface AlertConfig {
  type: AlertType;
  title?: string;
  message: string;
  confirmText: string;
  cancelText: string;
  placeholder: string;
  resolve: (value: boolean | string | null) => void;
}

export interface AlertOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  placeholder?: string;
}

@Injectable({ providedIn: 'root' })
export class PkAlertService {
  readonly current = signal<AlertConfig | null>(null);

  success(message: string, opts?: Pick<AlertOptions, 'title' | 'confirmText'>): Promise<void> {
    return this.open('success', message, opts) as Promise<void>;
  }

  error(message: string, opts?: Pick<AlertOptions, 'title' | 'confirmText'>): Promise<void> {
    return this.open('error', message, opts) as Promise<void>;
  }

  warning(message: string, opts?: Pick<AlertOptions, 'title' | 'confirmText'>): Promise<void> {
    return this.open('warning', message, opts) as Promise<void>;
  }

  info(message: string, opts?: Pick<AlertOptions, 'title' | 'confirmText'>): Promise<void> {
    return this.open('info', message, opts) as Promise<void>;
  }

  confirm(message: string, opts?: AlertOptions): Promise<boolean> {
    return this.open('confirm', message, opts) as Promise<boolean>;
  }

  input(message: string, opts?: AlertOptions): Promise<string | null> {
    return this.open('input', message, opts) as Promise<string | null>;
  }

  private open(type: AlertType, message: string, opts?: AlertOptions): Promise<unknown> {
    return new Promise((resolve) => {
      this.current.set({
        type,
        message,
        title: opts?.title,
        confirmText: opts?.confirmText ?? (type === 'confirm' || type === 'input' ? 'Confirm' : 'OK'),
        cancelText: opts?.cancelText ?? 'Cancel',
        placeholder: opts?.placeholder ?? '',
        resolve,
      });
    });
  }
}
