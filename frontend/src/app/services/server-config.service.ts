import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import config from '../configs/config';

export interface ServerAgent {
  agentid: number;
  groupid: number;
  name: string;
  detail: string;
  url: string;
  server_name: string;
  server_key?: string;
  isactive: number;
}

export interface ServerConfigGroup {
  groupid: number;
  group: string;
  detail: string;
  agents: ServerAgent[];
}

@Injectable({ providedIn: 'root' })
export class ServerConfigService {
  private readonly http = inject(HttpClient);

  private get authHeaders(): HttpHeaders {
    const token = sessionStorage.getItem(config.tokenName);
    return new HttpHeaders({ Authorization: `Bearer ${token ?? ''}` });
  }

  async getAll(): Promise<ServerConfigGroup[]> {
    const res = await firstValueFrom(
      this.http.get<{ groups: ServerConfigGroup[] }>(`${config.apiUrl}/servers`)
    );
    return res.groups;
  }

  createGroup(data: { group: string; detail: string }): Promise<ServerConfigGroup> {
    return firstValueFrom(
      this.http.post<ServerConfigGroup>(`${config.apiUrl}/servers/groups`, data, {
        headers: this.authHeaders,
      })
    );
  }

  updateGroup(groupid: number, data: { group: string; detail: string }): Promise<unknown> {
    return firstValueFrom(
      this.http.put(`${config.apiUrl}/servers/groups/${groupid}`, data, {
        headers: this.authHeaders,
      })
    );
  }

  deleteGroup(groupid: number): Promise<unknown> {
    return firstValueFrom(
      this.http.delete(`${config.apiUrl}/servers/groups/${groupid}`, {
        headers: this.authHeaders,
      })
    );
  }

  createAgent(data: Omit<ServerAgent, 'agentid'>): Promise<ServerAgent> {
    return firstValueFrom(
      this.http.post<ServerAgent>(`${config.apiUrl}/servers/agents`, data, {
        headers: this.authHeaders,
      })
    );
  }

  updateAgent(agentid: number, data: Partial<Omit<ServerAgent, 'agentid'>>): Promise<unknown> {
    return firstValueFrom(
      this.http.put(`${config.apiUrl}/servers/agents/${agentid}`, data, {
        headers: this.authHeaders,
      })
    );
  }

  deleteAgent(agentid: number): Promise<unknown> {
    return firstValueFrom(
      this.http.delete(`${config.apiUrl}/servers/agents/${agentid}`, {
        headers: this.authHeaders,
      })
    );
  }

  toggleAgent(agentid: number): Promise<{ agentid: number; isactive: number }> {
    return firstValueFrom(
      this.http.patch<{ agentid: number; isactive: number }>(
        `${config.apiUrl}/servers/agents/${agentid}/toggle`,
        {},
        { headers: this.authHeaders }
      )
    );
  }
}
