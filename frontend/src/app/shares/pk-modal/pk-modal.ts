import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  input,
  output,
  viewChild,
} from '@angular/core';

@Component({
  selector: 'pk-modal',
  templateUrl: './pk-modal.html',
  styleUrl: './pk-modal.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '(document:keydown)': 'onKeydown($event)',
  },
})
export class PkModal {
  private static nextId = 0;

  /** Modal title shown in the header */
  readonly title = input<string>('');

  /** Controls visibility */
  readonly isOpen = input<boolean>(false);

  /** Panel max-width: sm=380px | md=560px (default) | lg=860px | xl=1280px | full=100vw */
  readonly size = input<'sm' | 'md' | 'lg' | 'xl' | 'full'>('md');

  /** Emitted when the user closes the modal (backdrop click, ✕ button, or Escape) */
  readonly closed = output<void>();

  protected readonly titleId = `pk-modal-title-${++PkModal.nextId}`;
  private readonly panelRef = viewChild<ElementRef<HTMLElement>>('panel');

  constructor() {
    effect(() => {
      if (this.isOpen()) {
        queueMicrotask(() => this.panelRef()?.nativeElement.focus());
      }
    });
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.closed.emit();
    }
  }

  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape' && this.isOpen()) {
      this.closed.emit();
    }
  }
}
