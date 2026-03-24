import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import config from '../configs/config';

export interface User {
  userid: number;
  username: string;
  name: string;
  role: 'admin' | 'monitor';
  user_admin: number;
}

@Injectable({ providedIn: 'root' })
export class UserManagementService {
  private readonly http = inject(HttpClient);

  private get authHeaders(): HttpHeaders {
    const token = sessionStorage.getItem(config.tokenName);
    return new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` });
  }

  async getAll(): Promise<User[]> {
    const res = await firstValueFrom(
      this.http.get<{ users: User[] }>(`${config.apiUrl}/users`, { headers: this.authHeaders })
    );
    return res.users;
  }

  create(data: { username: string; name: string; password: string; role: string; user_admin: number }): Promise<User> {
    return firstValueFrom(
      this.http.post<User>(`${config.apiUrl}/users`, data, { headers: this.authHeaders })
    );
  }

  update(userid: number, data: { name?: string; role?: string; user_admin?: number; password?: string }): Promise<unknown> {
    return firstValueFrom(
      this.http.put(`${config.apiUrl}/users/${userid}`, data, { headers: this.authHeaders })
    );
  }

  delete(userid: number): Promise<unknown> {
    return firstValueFrom(
      this.http.delete(`${config.apiUrl}/users/${userid}`, { headers: this.authHeaders })
    );
  }
}
