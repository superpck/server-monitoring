import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  OnInit,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PkIcon } from '../../shares/pk-icon';
import { PkModal } from '../../shares/pk-modal';
import { PkToastrService } from '../../shares/pk-toastr';
import {
  ServerConfigService,
  ServerConfigGroup,
  ServerAgent,
} from '../../services/server-config.service';

interface GroupForm {
  groupid: number;
  group: string;
  detail: string;
}

interface AgentForm {
  groupid: number;
  name: string;
  detail: string;
  url: string;
  server_name: string;
  server_key: string;
  isactive: number;
}

@Component({
  selector: 'app-server-config',
  imports: [FormsModule, PkIcon, PkModal],
  templateUrl: './server-config.html',
  styleUrl: './server-config.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServerConfig implements OnInit {
  private readonly svc = inject(ServerConfigService);
  private readonly toastr = inject(PkToastrService);

  protected readonly groups = signal<ServerConfigGroup[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  protected readonly collapsedGroups = signal<Set<number>>(new Set());

  protected toggleCollapse(groupid: number): void {
    this.collapsedGroups.update(s => {
      const next = new Set(s);
      next.has(groupid) ? next.delete(groupid) : next.add(groupid);
      return next;
    });
  }

  // ── Group modal ──────────────────────────────────────────────────────────
  protected readonly groupModalOpen = signal(false);
  protected editingGroupId = signal<number | null>(null);
  protected groupForm = signal<GroupForm>({ groupid: 0, group: '', detail: '' });

  // ── Agent modal ──────────────────────────────────────────────────────────
  protected readonly agentModalOpen = signal(false);
  protected editingAgentId = signal<number | null>(null);
  protected agentForm = signal<AgentForm>({ groupid: 0, name: '', detail: '', url: '', server_name: '', server_key: '', isactive: 1 });
  protected showServerKey = signal(false);

  // ── Delete confirm ───────────────────────────────────────────────────────
  protected readonly deleteModalOpen = signal(false);
  protected deleteTarget = signal<{ type: 'group' | 'agent'; id: number; label: string } | null>(null);

  // ── Drag-and-drop ────────────────────────────────────────────────────────
  protected readonly dragGroupIdx = signal<number | null>(null);
  protected readonly dragOverGroupIdx = signal<number | null>(null);
  protected readonly dragAgentInfo = signal<{ groupid: number; idx: number } | null>(null);
  protected readonly dragOverAgentInfo = signal<{ groupid: number; idx: number } | null>(null);

  ngOnInit(): void {
    this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      this.groups.set(await this.svc.getAll());
    } catch {
      this.toastr.error('Failed to load data');
    } finally {
      this.loading.set(false);
    }
  }

  // ── Group actions ─────────────────────────────────────────────────────────
  protected openAddGroup(): void {
    this.editingGroupId.set(null);
    this.groupForm.set({ groupid: 0, group: '', detail: '' });
    this.groupModalOpen.set(true);
  }

  protected openEditGroup(g: ServerConfigGroup): void {
    this.editingGroupId.set(g.groupid);
    this.groupForm.set({ groupid: g.groupid, group: g.group, detail: g.detail });
    this.groupModalOpen.set(true);
  }

  protected updateGroupForm(patch: Partial<GroupForm>): void {
    this.groupForm.update(f => ({ ...f, ...patch }));
  }

  protected async saveGroup(): Promise<void> {
    const form = this.groupForm();
    if (!form.group.trim()) return;
    this.saving.set(true);
    try {
      const gid = this.editingGroupId();
      if (gid !== null) {
        await this.svc.updateGroup(gid, form);
        this.groups.update(gs =>
          gs.map(g => g.groupid === gid ? { ...g, ...form } : g)
        );
        this.toastr.success('Group updated');
      } else {
        const created = await this.svc.createGroup(form);
        this.groups.update(gs => [...gs, created]);
        this.toastr.success('Group created');
      }
      this.groupModalOpen.set(false);
    } catch {
      this.toastr.error('Failed to save');
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDeleteGroup(g: ServerConfigGroup): void {
    this.deleteTarget.set({ type: 'group', id: g.groupid, label: g.group });
    this.deleteModalOpen.set(true);
  }

  // ── Agent actions ─────────────────────────────────────────────────────────
  protected openAddAgent(groupid: number): void {
    this.editingAgentId.set(null);
    this.agentForm.set({ groupid, name: '', detail: '', url: '', server_name: '', server_key: '', isactive: 1 });
    this.showServerKey.set(false);
    this.agentModalOpen.set(true);
  }

  protected openEditAgent(a: ServerAgent): void {
    this.editingAgentId.set(a.agentid);
    this.agentForm.set({
      groupid: a.groupid,
      name: a.name,
      detail: a.detail,
      url: a.url,
      server_name: a.server_name,
      server_key: '',
      isactive: a.isactive,
    });
    this.showServerKey.set(false);
    this.agentModalOpen.set(true);
  }

  protected updateAgentForm(patch: Partial<AgentForm>): void {
    this.agentForm.update(f => ({ ...f, ...patch }));
  }

  protected async saveAgent(): Promise<void> {
    const form = this.agentForm();
    if (!form.name.trim() || !form.url.trim()) return;
    this.saving.set(true);
    try {
      const aid = this.editingAgentId();
      if (aid !== null) {
        const { server_key, ...rest } = form;
        const payload = server_key?.trim() ? { ...rest, server_key } : rest;
        console.log(payload);
        await this.svc.updateAgent(aid, payload);
        this.groups.update(gs =>
          gs.map(g => ({
            ...g,
            agents: g.agents.map(a => a.agentid === aid ? { ...a, ...rest } : a),
          }))
        );
        this.toastr.success('Agent updated');
      } else {
        const created = await this.svc.createAgent(form);
        this.groups.update(gs =>
          gs.map(g => g.groupid === form.groupid ? { ...g, agents: [...g.agents, created] } : g)
        );
        this.toastr.success('Agent created');
      }
      this.agentModalOpen.set(false);
    } catch {
      this.toastr.error('Failed to save');
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDeleteAgent(a: ServerAgent): void {
    this.deleteTarget.set({ type: 'agent', id: a.agentid, label: a.name });
    this.deleteModalOpen.set(true);
  }

  protected async toggleAgent(a: ServerAgent, groupid: number): Promise<void> {
    try {
      const res = await this.svc.toggleAgent(a.agentid);
      this.groups.update(gs =>
        gs.map(g => g.groupid === groupid
          ? { ...g, agents: g.agents.map(ag => ag.agentid === a.agentid ? { ...ag, isactive: res.isactive } : ag) }
          : g
        )
      );
    } catch {
      this.toastr.error('Failed to update status');
    }
  }

  // ── Delete confirm ────────────────────────────────────────────────────────
  protected async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.saving.set(true);
    try {
      if (target.type === 'group') {
        await this.svc.deleteGroup(target.id);
        this.groups.update(gs => gs.filter(g => g.groupid !== target.id));
        this.toastr.success('Group deleted');
      } else {
        await this.svc.deleteAgent(target.id);
        this.groups.update(gs =>
          gs.map(g => ({ ...g, agents: g.agents.filter(a => a.agentid !== target.id) }))
        );
        this.toastr.success('Agent deleted');
      }
      this.deleteModalOpen.set(false);
      this.deleteTarget.set(null);
    } catch {
      this.toastr.error('Failed to delete');
    } finally {
      this.saving.set(false);
    }
  }

  // ── Drag-and-drop: Groups ─────────────────────────────────────────────────
  protected onGroupDragStart(event: DragEvent, idx: number): void {
    this.dragGroupIdx.set(idx);
    event.dataTransfer!.effectAllowed = 'move';
  }

  protected onGroupDragOver(event: DragEvent, idx: number): void {
    if (this.dragGroupIdx() === null) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dragOverGroupIdx.set(idx);
  }

  protected onGroupDrop(event: DragEvent, toIdx: number): void {
    event.preventDefault();
    const fromIdx = this.dragGroupIdx();
    if (fromIdx === null || fromIdx === toIdx) {
      this.dragGroupIdx.set(null);
      this.dragOverGroupIdx.set(null);
      return;
    }
    this.groups.update(gs => {
      const arr = [...gs];
      const [moved] = arr.splice(fromIdx, 1);
      arr.splice(toIdx, 0, moved);
      return arr;
    });
    this.dragGroupIdx.set(null);
    this.dragOverGroupIdx.set(null);
    this.saveGroupOrder();
  }

  protected onGroupDragEnd(): void {
    this.dragGroupIdx.set(null);
    this.dragOverGroupIdx.set(null);
  }

  private async saveGroupOrder(): Promise<void> {
    const updates = this.groups().map((g, i) => ({ groupid: g.groupid, seq: (i + 1) * 10 }));
    try {
      await this.svc.reorderGroups(updates);
      this.groups.update(gs => gs.map((g, i) => ({ ...g, seq: (i + 1) * 10 })));
      this.toastr.success('Group order saved');
    } catch {
      this.toastr.error('Failed to save order');
    }
  }

  // ── Drag-and-drop: Agents ─────────────────────────────────────────────────
  protected onAgentDragStart(event: DragEvent, groupid: number, idx: number): void {
    this.dragAgentInfo.set({ groupid, idx });
    event.dataTransfer!.effectAllowed = 'move';
  }

  protected onAgentDragOver(event: DragEvent, groupid: number, idx: number): void {
    const drag = this.dragAgentInfo();
    if (!drag || drag.groupid !== groupid) return;
    event.preventDefault();
    event.dataTransfer!.dropEffect = 'move';
    this.dragOverAgentInfo.set({ groupid, idx });
  }

  protected onAgentDrop(event: DragEvent, groupid: number, toIdx: number): void {
    event.preventDefault();
    const drag = this.dragAgentInfo();
    if (!drag || drag.groupid !== groupid || drag.idx === toIdx) {
      this.dragAgentInfo.set(null);
      this.dragOverAgentInfo.set(null);
      return;
    }
    this.groups.update(gs => gs.map(g => {
      if (g.groupid !== groupid) return g;
      const agents = [...g.agents];
      const [moved] = agents.splice(drag.idx, 1);
      agents.splice(toIdx, 0, moved);
      return { ...g, agents };
    }));
    this.dragAgentInfo.set(null);
    this.dragOverAgentInfo.set(null);
    this.saveAgentOrder(groupid);
  }

  protected onAgentDragEnd(): void {
    this.dragAgentInfo.set(null);
    this.dragOverAgentInfo.set(null);
  }

  private async saveAgentOrder(groupid: number): Promise<void> {
    const g = this.groups().find(g => g.groupid === groupid);
    if (!g) return;
    const updates = g.agents.map((a, i) => ({ agentid: a.agentid, seq: (i + 1) * 10 }));
    try {
      await this.svc.reorderAgents(updates);
      this.groups.update(gs => gs.map(g => {
        if (g.groupid !== groupid) return g;
        return { ...g, agents: g.agents.map((a, i) => ({ ...a, seq: (i + 1) * 10 })) };
      }));
      this.toastr.success('Agent order saved');
    } catch {
      this.toastr.error('Failed to save order');
    }
  }
}
