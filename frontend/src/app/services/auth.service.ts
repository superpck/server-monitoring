import { Injectable, signal, computed } from '@angular/core';
import config from '../configs/config';

interface JwtPayload {
  sub: string;
  role: string;
  user_admin: number;
  exp: number;
  name?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly _payload = signal<JwtPayload | null>(this.readPayload());
  private _expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly isAdmin = computed(() => this._payload()?.role === 'admin');
  readonly isUserAdmin = computed(() => this._payload()?.user_admin === 1);
  readonly username = computed(() => this._payload()?.sub ?? '');
  readonly displayName = computed(() => this._payload()?.name || this._payload()?.sub || '');

  private readPayload(): JwtPayload | null {
    try {
      const token = sessionStorage.getItem(config.tokenName);
      if (!token) return null;
      return JSON.parse(atob(token.split('.')[1])) as JwtPayload;
    } catch {
      return null;
    }
  }

  /** Call after login to refresh the payload signal. */
  refresh(): void {
    this._payload.set(this.readPayload());
  }

  /** Call on logout to clear state. */
  clear(): void {
    this.stopExpiryWatch();
    this._payload.set(null);
  }

  /**
   * Schedule an automatic logout when the JWT expires.
   * Replaces any previously scheduled timer.
   */
  startExpiryWatch(onExpire: () => void): void {
    this.stopExpiryWatch();
    const exp = this._payload()?.exp;
    if (!exp) return;
    const msLeft = exp * 1000 - Date.now();
    if (msLeft <= 0) {
      this.clear();
      onExpire();
      return;
    }
    this._expiryTimer = setTimeout(() => {
      this.clear();
      onExpire();
    }, msLeft);
  }

  stopExpiryWatch(): void {
    if (this._expiryTimer !== null) {
      clearTimeout(this._expiryTimer);
      this._expiryTimer = null;
    }
  }
}
