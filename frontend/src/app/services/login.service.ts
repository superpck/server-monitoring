import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import config from '../configs/config';

export interface LoginResponse {
  token: string;
  expiresIn: string;
}

@Injectable({ providedIn: 'root' })
export class LoginService {
  private readonly http = inject(HttpClient);

  async login(username: string, password: string): Promise<void> {
    const res = await firstValueFrom(
      this.http.post<LoginResponse>(`${config.apiUrl}/auth/login`, { username, password })
    );
    sessionStorage.setItem(config.tokenName, res.token);
  }

  logout(): void {
    sessionStorage.removeItem(config.tokenName);
  }

  getToken(): string | null {
    return sessionStorage.getItem(config.tokenName);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }
}
