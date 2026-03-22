import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly doc = inject(DOCUMENT);
  private readonly STORAGE_KEY = 'app:theme';

  readonly isDark = signal<boolean>(this.initTheme());

  constructor() {
    effect(() => {
      if (this.isDark()) {
        this.doc.documentElement.removeAttribute('data-theme');
      } else {
        this.doc.documentElement.setAttribute('data-theme', 'light');
      }
      localStorage.setItem(this.STORAGE_KEY, this.isDark() ? 'dark' : 'light');
    });
  }

  toggle(): void {
    this.isDark.update((v) => !v);
  }

  private initTheme(): boolean {
    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored === 'dark') return true;
    if (stored === 'light') return false;
    return this.doc.defaultView?.matchMedia('(prefers-color-scheme: dark)').matches ?? true;
  }
}
