import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { PkAlertService } from './pk-alert.service';

const ICON: Record<string, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
  confirm: '?',
  input: '✏',
};

@Component({
  selector: 'pk-alert',
  templateUrl: './pk-alert.html',
  styleUrl: './pk-alert.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class PkAlert {
  protected readonly svc = inject(PkAlertService);
  protected readonly icon = ICON;
  protected readonly inputValue = signal('');

  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');
  private readonly inputRef = viewChild<ElementRef<HTMLInputElement>>('inputField');

  constructor() {
    effect(() => {
      const config = this.svc.current();
      if (config) {
        this.inputValue.set('');
        queueMicrotask(() => {
          if (config.type === 'input') {
            this.inputRef()?.nativeElement.focus();
          } else {
            this.panelRef()?.nativeElement.focus();
          }
        });
      }
    });
  }

  protected isActionType(): boolean {
    const t = this.svc.current()?.type;
    return t === 'confirm' || t === 'input';
  }

  protected confirm(): void {
    const config = this.svc.current();
    if (!config) return;
    const value: boolean | string = config.type === 'input' ? this.inputValue() : true;
    config.resolve(value);
    this.svc.current.set(null);
  }

  protected cancel(): void {
    const config = this.svc.current();
    if (!config) return;
    config.resolve(config.type === 'input' ? null : false);
    this.svc.current.set(null);
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target !== event.currentTarget) return;
    this.isActionType() ? this.cancel() : this.confirm();
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (!this.svc.current()) return;
    if (event.key === 'Escape') {
      this.isActionType() ? this.cancel() : this.confirm();
    }
  }

  protected onInputKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter') this.confirm();
    if (event.key === 'Escape') this.cancel();
  }
}
