/**
 * PkTabs — Tab navigation component
 *
 * @usage
 * ```html
 * <!-- Basic -->
 * <pk-tabs [tabs]="tabs" [(activeId)]="activeTab">
 *   <div *pkTabPanel="'overview'">Overview content</div>
 *   <div *pkTabPanel="'details'">Details content</div>
 * </pk-tabs>
 *
 * <!-- Using signal -->
 * <pk-tabs [tabs]="tabs" [activeId]="tab()" (activeIdChange)="tab.set($event)">
 *   ...
 * </pk-tabs>
 * ```
 *
 * @inputs
 * | Input          | Type          | Default   | Description                        |
 * |----------------|---------------|-----------|------------------------------------|
 * | `tabs`         | `PkTab[]`     | `[]`      | Array of `{ id, label, disabled? }`|
 * | `activeId`     | `string`      | first tab | Active tab id (two-way bindable)   |
 * | `variant`      | `'line'\|'pill'` | `'line'` | Visual style                      |
 *
 * @outputs
 * | Output           | Type     | Description              |
 * |------------------|----------|--------------------------|
 * | `activeIdChange` | `string` | Emitted on tab change    |
 *
 * @notes
 * - Use `*pkTabPanel="'id'"` directive on panel content (optional; you can also handle visibility manually).
 * - Keyboard: Arrow keys navigate, Enter/Space activate.
 * - Passes ARIA `tablist` / `tab` / `tabpanel` roles.
 */
import {
  ChangeDetectionStrategy,
  Component,
  Directive,
  OnChanges,
  SimpleChanges,
  computed,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

export interface PkTab {
  id: string;
  label: string;
  disabled?: boolean;
}

// ── Tab Panel Directive ────────────────────────────────────────────
import { TemplateRef, ViewContainerRef, inject, Input, OnInit } from '@angular/core';

@Directive({
  selector: '[pkTabPanel]',
})
export class PkTabPanel implements OnInit {
  @Input('pkTabPanel') panelId!: string;

  readonly templateRef = inject(TemplateRef<unknown>);
  private readonly vcr = inject(ViewContainerRef);

  ngOnInit(): void {
    // Panels are rendered by PkTabs via *ngTemplateOutlet — nothing to do here.
  }
}

// ── Tabs Component ─────────────────────────────────────────────────
import { ContentChildren, QueryList, AfterContentInit } from '@angular/core';

@Component({
  selector: 'pk-tabs',
  imports: [NgTemplateOutlet],
  templateUrl: './pk-tabs.html',
  styleUrl: './pk-tabs.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PkTabs implements OnChanges, AfterContentInit {
  /** Tab definitions */
  readonly tabs = input<PkTab[]>([]);

  /** Currently active tab id — supports two-way binding via [(activeId)] */
  readonly activeId = model<string>('');

  /** Visual variant */
  readonly variant = input<'line' | 'pill'>('line');

  /** Emitted when active tab changes */
  readonly activeIdChange = output<string>();

  @ContentChildren(PkTabPanel) panelDirectives!: QueryList<PkTabPanel>;

  protected readonly _activeId = signal('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['activeId']) {
      const val = changes['activeId'].currentValue as string;
      if (val) this._activeId.set(val);
    }
  }

  ngAfterContentInit(): void {
    // Set default active tab if not provided
    if (!this._activeId()) {
      const tabList = this.tabs();
      const first = tabList.find((t) => !t.disabled);
      if (first) this._activeId.set(first.id);
    }
  }

  protected activePanelTemplate = computed(() => {
    return this.panelDirectives?.find((p) => p.panelId === this._activeId())?.templateRef ?? null;
  });

  protected select(tab: PkTab): void {
    if (tab.disabled) return;
    this._activeId.set(tab.id);
    this.activeId.set(tab.id);
    this.activeIdChange.emit(tab.id);
  }

  protected onKeydown(event: KeyboardEvent, index: number): void {
    const tabList = this.tabs().filter((t) => !t.disabled);
    const currentIndex = tabList.findIndex((t) => t.id === this._activeId());
    let next = currentIndex;

    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      next = (currentIndex + 1) % tabList.length;
      event.preventDefault();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      next = (currentIndex - 1 + tabList.length) % tabList.length;
      event.preventDefault();
    } else if (event.key === 'Home') {
      next = 0;
      event.preventDefault();
    } else if (event.key === 'End') {
      next = tabList.length - 1;
      event.preventDefault();
    } else {
      return;
    }

    this.select(tabList[next]);
    // Move focus to the new active tab button
    const el = (event.target as HTMLElement).closest('[role="tablist"]');
    queueMicrotask(() => {
      (el?.querySelector(`[aria-selected="true"]`) as HTMLElement)?.focus();
    });
  }
}
