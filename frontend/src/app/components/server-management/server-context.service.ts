import { Injectable, signal } from '@angular/core';

export interface ServerItem {
  name: string;
  url: string;
  agentid: number;
}

export interface ServerGroup {
  groupid?: number;
  group: string;
  agents: ServerItem[];
}

@Injectable()
export class ServerContextService {
  readonly selectedServer = signal<ServerItem | null>(null);
}
