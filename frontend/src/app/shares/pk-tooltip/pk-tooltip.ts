/**
 * PkTooltip — Tooltip directive
 *
 * @usage
 * ```html
 * <!-- Basic (shows above element by default) -->
 * <button [pkTooltip]="'Click to save'">Save</button>
 *
 * <!-- Custom position -->
 * <span [pkTooltip]="'Hello'" pkTooltipPosition="bottom">Hover me</span>
 *
 * <!-- Custom delay (ms) -->
 * <span [pkTooltip]="'Delayed'" [pkTooltipDelay]="500">Delayed</span>
 *
 * <!-- Dynamic content -->
 * <div [pkTooltip]="agent.detail || ''">{{ agent.name }}</div>
 *
 * <!-- Disable by passing empty string -->
 * <div [pkTooltip]="showTip ? 'Info' : ''">Item</div>
 * ```
 *
 * @inputs
 * | Input                | Type                              | Default  | Description              |
 * |----------------------|-----------------------------------|----------|--------------------------|
 * | `pkTooltip`          | `string`                          | `''`     | Tooltip text             |
 * | `pkTooltipPosition`  | `'top' \| 'bottom' \| 'left' \| 'right'` | `'top'` | Placement    |
 * | `pkTooltipDelay`     | `number`                          | `200`    | Show delay (ms)          |
 *
 * @notes
 * - Tooltip is appended to `<body>` and auto-clipped to the viewport.
 * - Responds to both mouse (mouseenter/mouseleave) and keyboard (focus/blur).
 * - Passing an empty string suppresses the tooltip entirely.
 * - Import `PkTooltip` in your component's `imports` array (standalone).
 */

import {
  Directive,
  ElementRef,
  Renderer2,
  input,
  inject,
  OnDestroy,
} from '@angular/core';

@Directive({
  selector: '[pkTooltip]',
  host: {
    '(mouseenter)': 'show()',
    '(mouseleave)': 'hide()',
    '(focus)': 'show()',
    '(blur)': 'hide()',
  },
})
export class PkTooltip implements OnDestroy {
  private readonly el = inject(ElementRef<HTMLElement>);
  private readonly renderer = inject(Renderer2);

  /** Tooltip content */
  readonly pkTooltip = input<string>('');

  /** Tooltip position: top | bottom | left | right */
  readonly pkTooltipPosition = input<'top' | 'bottom' | 'left' | 'right'>('bottom');

  /** Show delay in milliseconds */
  readonly pkTooltipDelay = input<number>(200);

  private tooltipElement: HTMLElement | null = null;
  private showTimeout: any = null;

  show(): void {
    const text = this.pkTooltip();
    if (!text || this.tooltipElement) return;

    this.showTimeout = setTimeout(() => {
      this.tooltipElement = this.renderer.createElement('div');
      this.renderer.addClass(this.tooltipElement, 'pk-tooltip');
      this.renderer.addClass(this.tooltipElement, `pk-tooltip--${this.pkTooltipPosition()}`);
      this.renderer.setAttribute(this.tooltipElement, 'role', 'tooltip');
      
      const textNode = this.renderer.createText(text);
      this.renderer.appendChild(this.tooltipElement, textNode);
      this.renderer.appendChild(document.body, this.tooltipElement);

      // Position tooltip
      this.positionTooltip();
    }, this.pkTooltipDelay());
  }

  hide(): void {
    if (this.showTimeout) {
      clearTimeout(this.showTimeout);
      this.showTimeout = null;
    }

    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostRect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();
    const position = this.pkTooltipPosition();
    const gap = 8;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = hostRect.top - tooltipRect.height - gap;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'bottom':
        top = hostRect.bottom + gap;
        left = hostRect.left + (hostRect.width - tooltipRect.width) / 2;
        break;
      case 'left':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.left - tooltipRect.width - gap;
        break;
      case 'right':
        top = hostRect.top + (hostRect.height - tooltipRect.height) / 2;
        left = hostRect.right + gap;
        break;
    }

    // Prevent overflow
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    if (left < 8) left = 8;
    if (left + tooltipRect.width > viewportWidth - 8) {
      left = viewportWidth - tooltipRect.width - 8;
    }

    if (top < 8) top = 8;
    if (top + tooltipRect.height > viewportHeight - 8) {
      top = viewportHeight - tooltipRect.height - 8;
    }

    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }

  ngOnDestroy(): void {
    this.hide();
  }
}
