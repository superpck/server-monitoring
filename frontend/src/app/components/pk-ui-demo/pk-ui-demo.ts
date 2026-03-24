import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { PkIcon } from '../../shares/pk-icon';
import { PkTooltip } from '../../shares/pk-tooltip';
import { PkModal } from '../../shares/pk-modal';
import { PkTabs, PkTabPanel } from '../../shares/pk-tabs';
import type { PkTab } from '../../shares/pk-tabs';
import { PkAlertService } from '../../shares/pk-alert/pk-alert.service';
import { PkToastrService } from '../../shares/pk-toastr/pk-toastr.service';

const ALL_ICONS = [
  'server', 'sun', 'moon', 'sidebar-open', 'sidebar-close', 'activity',
  'database', 'cpu', 'process', 'home', 'x-circle', 'alert-circle', 'user',
  'key', 'sign-in', 'logo', 'eye', 'eye-off', 'pencil', 'check', 'x', 'save',
  'trash', 'link', 'link-broken', 'search', 'code', 'clock',
  'chevron-down', 'chevron-right', 'chevron-up', 'chevron-left',
  'monitor', 'zap', 'github',
] as const;

@Component({
  selector: 'app-pk-ui-demo',
  imports: [PkIcon, PkTooltip, PkModal, PkTabs, PkTabPanel],
  templateUrl: './pk-ui-demo.html',
  styleUrl: './pk-ui-demo.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PkUiDemo {
  private readonly alert = inject(PkAlertService);
  private readonly toastr = inject(PkToastrService);

  protected readonly icons = ALL_ICONS;
  protected readonly iconSize = signal(24);
  protected readonly modalOpen = signal(false);
  protected readonly modalSize = signal<'sm' | 'md' | 'lg' | 'xl' | 'full'>('md');
  protected readonly alertResult = signal<string>('');
  protected readonly tooltipPos = signal<'top' | 'bottom' | 'left' | 'right'>('top');

  protected readonly demoTabsLine: PkTab[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'details', label: 'Details' },
    { id: 'logs', label: 'Logs' },
    { id: 'disabled', label: 'Disabled', disabled: true },
  ];
  protected readonly demoTabsPill: PkTab[] = [
    { id: 'day', label: 'Day' },
    { id: 'week', label: 'Week' },
    { id: 'month', label: 'Month' },
  ];
  protected readonly activeLineTab = signal('overview');
  protected readonly activePillTab = signal('day');

  protected readonly navTabs: PkTab[] = [
    { id: 'icon',    label: 'pk-icon' },
    { id: 'tooltip', label: 'pk-tooltip' },
    { id: 'modal',   label: 'pk-modal' },
    { id: 'toastr',  label: 'pk-toastr' },
    { id: 'tabs',    label: 'pk-tabs' },
    { id: 'alert',   label: 'pk-alert' },
    { id: 'css',     label: 'pk css class' },
  ];
  protected readonly activeNavTab = signal('icon');

  protected readonly cssTabs: PkTab[] = [
    { id: 'spinner', label: 'pk-spinner' },
    { id: 'card',    label: 'pk-card' },
    { id: 'grid',    label: 'pk-grid' },
    { id: 'blink',   label: 'blink' },
  ];
  protected readonly activeCssTab = signal('spinner');

  // ── Toastr ──────────────────────────────────────────────────
  showToast(type: 'success' | 'error' | 'warning' | 'info'): void {
    const msgs: Record<string, string> = {
      success: 'Operation completed successfully!',
      error: 'Something went wrong.',
      warning: 'Please review your input.',
      info: 'Here is some useful information.',
    };
    this.toastr[type](msgs[type], type.charAt(0).toUpperCase() + type.slice(1));
  }

  // ── Alert ────────────────────────────────────────────────────
  async showAlert(type: 'success' | 'error' | 'warning' | 'info'): Promise<void> {
    await this.alert[type](`This is a ${type} alert message.`, { title: type.charAt(0).toUpperCase() + type.slice(1) });
    this.alertResult.set(`closed: ${type}`);
  }

  async showConfirm(): Promise<void> {
    const ok = await this.alert.confirm('Are you sure you want to proceed?', {
      title: 'Confirm Action',
      confirmText: 'Yes, proceed',
      cancelText: 'Cancel',
    });
    this.alertResult.set(`confirm result: ${ok}`);
  }

  async showInput(): Promise<void> {
    const val = await this.alert.input('Enter your name:', {
      title: 'Input Required',
      placeholder: 'Your name...',
      confirmText: 'Submit',
    });
    this.alertResult.set(`input result: ${val ?? 'cancelled'}`);
  }
}
