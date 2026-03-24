import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PkIcon } from '../../shares/pk-icon';
import { PkModal } from '../../shares/pk-modal';
import { PkToastrService } from '../../shares/pk-toastr';
import { UserManagementService, User, UserAccess } from '../../services/user-management.service';
import { ServerConfigService } from '../../services/server-config.service';
import { AuthService } from '../../services/auth.service';

interface UserForm {
  username: string;
  name: string;
  role: 'admin' | 'monitor';
  user_admin: number;
  password: string;
}

interface AgentItem {
  agentid: number;
  name: string;
  group: string;
  checked: boolean;
}

@Component({
  selector: 'app-user-management',
  imports: [FormsModule, PkIcon, PkModal],
  templateUrl: './user-management.html',
  styleUrl: './user-management.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserManagement implements OnInit {
  private readonly svc = inject(UserManagementService);
  private readonly serverConfig = inject(ServerConfigService);
  private readonly toastr = inject(PkToastrService);
  protected readonly auth = inject(AuthService);

  protected readonly users = signal<User[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);

  // Add / Edit modal
  protected readonly modalOpen = signal(false);
  protected readonly editingUserId = signal<number | null>(null);
  protected readonly showPassword = signal(false);
  protected readonly userForm = signal<UserForm>({
    username: '', name: '', role: 'monitor', user_admin: 0, password: '',
  });

  // Delete confirm modal
  protected readonly deleteModalOpen = signal(false);
  protected readonly deleteTarget = signal<{ userid: number; label: string } | null>(null);

  // Access modal
  protected readonly accessModalOpen = signal(false);
  protected readonly accessTarget = signal<User | null>(null);
  protected readonly accessType = signal<'all' | 'partial'>('all');
  protected readonly accessAgentList = signal<AgentItem[]>([]);
  protected readonly accessLoading = signal(false);
  protected readonly accessSaving = signal(false);

  protected readonly isEditing = computed(() => this.editingUserId() !== null);

  ngOnInit(): void {
    this.loadAll();
  }

  private async loadAll(): Promise<void> {
    this.loading.set(true);
    try {
      this.users.set(await this.svc.getAll());
    } catch {
      this.toastr.error('Failed to load users');
    } finally {
      this.loading.set(false);
    }
  }

  protected updateForm(patch: Partial<UserForm>): void {
    this.userForm.update(f => ({ ...f, ...patch }));
  }

  protected openAddUser(): void {
    this.toastr.info('Creating a new user. Please fill in the details and click Save.');
    this.editingUserId.set(null);
    this.userForm.set({ username: '', name: '', role: 'monitor', user_admin: 0, password: '' });
    this.showPassword.set(false);
    this.modalOpen.set(true);
  }

  protected openEditUser(user: User): void {
    this.editingUserId.set(user.userid);
    this.userForm.set({
      username: user.username,
      name: user.name,
      role: user.role,
      user_admin: user.user_admin,
      password: '',
    });
    this.showPassword.set(false);
    this.modalOpen.set(true);
  }

  protected async saveUser(): Promise<void> {
    const form = this.userForm();
    if (!form.name.trim()) return;
    if (!this.isEditing() && !form.username.trim()) return;
    if (!this.isEditing() && !form.password.trim()) return;
    this.saving.set(true);
    try {
      if (this.isEditing()) {
        const payload: Record<string, unknown> = {
          name: form.name,
          role: form.role,
          user_admin: form.user_admin,
        };
        if (form.password.trim()) payload['password'] = form.password;
        await this.svc.update(this.editingUserId()!, payload);
        this.users.update(list =>
          list.map(u =>
            u.userid === this.editingUserId()!
              ? { ...u, name: form.name, role: form.role, user_admin: form.user_admin }
              : u
          )
        );
        this.toastr.success('User updated');
      } else {
        const newUser = await this.svc.create({
          username: form.username,
          name: form.name,
          password: form.password,
          role: form.role,
          user_admin: form.user_admin,
        });
        this.users.update(list => [...list, newUser]);
        this.toastr.success('User created');
      }
      this.modalOpen.set(false);
    } catch (err: any) {
      this.toastr.error(err?.error?.message ?? 'Failed to save user');
    } finally {
      this.saving.set(false);
    }
  }

  protected confirmDeleteUser(user: User): void {
    this.deleteTarget.set({ userid: user.userid, label: user.username });
    this.deleteModalOpen.set(true);
  }

  protected async confirmDelete(): Promise<void> {
    const target = this.deleteTarget();
    if (!target) return;
    this.saving.set(true);
    try {
      await this.svc.delete(target.userid);
      this.users.update(list => list.filter(u => u.userid !== target.userid));
      this.toastr.success('User deleted');
      this.deleteModalOpen.set(false);
    } catch (err: any) {
      this.toastr.error(err?.error?.message ?? 'Failed to delete user');
    } finally {
      this.saving.set(false);
    }
  }

  protected isSelf(user: User): boolean {
    return user.username === this.auth.username();
  }

  protected async openAccessModal(user: User): Promise<void> {
    this.accessTarget.set(user);
    this.accessType.set('all');
    this.accessAgentList.set([]);
    this.accessLoading.set(true);
    this.accessModalOpen.set(true);
    try {
      const [access, groups] = await Promise.all([
        this.svc.getAccess(user.userid),
        this.serverConfig.getAll(),
      ]);
      this.accessType.set(access.access_type);
      const allowedSet = new Set(access.agents);
      const items: AgentItem[] = groups.flatMap(g =>
        g.agents.map(a => ({
          agentid: a.agentid,
          name: a.name,
          group: g.group,
          checked: allowedSet.has(a.agentid),
        }))
      );
      this.accessAgentList.set(items);
    } catch {
      this.toastr.error('Failed to load access data');
      this.accessModalOpen.set(false);
    } finally {
      this.accessLoading.set(false);
    }
  }

  protected toggleAgentAccess(agentid: number): void {
    this.accessAgentList.update(list =>
      list.map(a => a.agentid === agentid ? { ...a, checked: !a.checked } : a)
    );
  }

  protected async saveAccess(): Promise<void> {
    const user = this.accessTarget();
    if (!user) return;
    const accessType = this.accessType();
    const agents = this.accessAgentList().filter(a => a.checked).map(a => a.agentid);
    this.accessSaving.set(true);
    try {
      await this.svc.updateAccess(user.userid, {
        access_type: accessType,
        agents: accessType === 'partial' ? agents : [],
      });
      this.toastr.success('Access updated');
      this.accessModalOpen.set(false);
    } catch (err: any) {
      this.toastr.error(err?.error?.message ?? 'Failed to update access');
    } finally {
      this.accessSaving.set(false);
    }
  }
}
