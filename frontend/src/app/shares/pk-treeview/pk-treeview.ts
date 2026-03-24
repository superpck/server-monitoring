import {
  ChangeDetectionStrategy,
  Component,
  effect,
  input,
  model,
  output,
  signal,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { PkIcon } from '../pk-icon';

export interface TreeNode {
  id: string | number;
  label: string;
  icon?: string;
  children?: TreeNode[];
  data?: unknown;
  disabled?: boolean;
  badge?: string | number;
  badgeClass?: string;
}

@Component({
  selector: 'pk-treeview',
  imports: [NgTemplateOutlet, PkIcon],
  templateUrl: './pk-treeview.html',
  styleUrl: './pk-treeview.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PkTreeview {
  readonly nodes = input<TreeNode[]>([]);
  readonly selectedId = model<string | number | null>(null);
  readonly expandAll = input<boolean>(false);
  readonly checkable = input<boolean>(false);
  readonly checkedIds = model<Set<string | number>>(new Set());

  readonly nodeSelect = output<TreeNode>();
  readonly nodeToggle = output<{ node: TreeNode; expanded: boolean }>();

  protected readonly expandedIds = signal<Set<string | number>>(new Set());

  constructor() {
    effect(() => {
      if (this.expandAll()) {
        const ids = new Set<string | number>();
        const collect = (nodes: TreeNode[]) => {
          for (const node of nodes) {
            if (node.children?.length) {
              ids.add(node.id);
              collect(node.children);
            }
          }
        };
        collect(this.nodes());
        this.expandedIds.set(ids);
      }
    });
  }

  protected isExpanded(id: string | number): boolean {
    return this.expandedIds().has(id);
  }

  protected hasChildren(node: TreeNode): boolean {
    return !!(node.children && node.children.length > 0);
  }

  protected toggle(node: TreeNode, event: Event): void {
    event.stopPropagation();
    if (!this.hasChildren(node)) return;
    const ids = new Set(this.expandedIds());
    const expanded = !ids.has(node.id);
    expanded ? ids.add(node.id) : ids.delete(node.id);
    this.expandedIds.set(ids);
    this.nodeToggle.emit({ node, expanded });
  }

  protected select(node: TreeNode, event: Event): void {
    event.stopPropagation();
    if (node.disabled) return;
    this.selectedId.set(node.id);
    this.nodeSelect.emit(node);
  }

  protected rowClick(node: TreeNode, event: Event): void {
    if (this.checkable()) {
      this.toggleCheck(node, event);
    } else {
      this.select(node, event);
    }
  }

  private getLeafIds(node: TreeNode): (string | number)[] {
    if (!node.children?.length) return [node.id];
    return node.children.flatMap(c => this.getLeafIds(c));
  }

  protected isChecked(node: TreeNode): boolean {
    const leaves = this.getLeafIds(node);
    return leaves.length > 0 && leaves.every(id => this.checkedIds().has(id));
  }

  protected isIndeterminate(node: TreeNode): boolean {
    if (!this.hasChildren(node)) return false;
    const leaves = this.getLeafIds(node);
    const checkedCount = leaves.filter(id => this.checkedIds().has(id)).length;
    return checkedCount > 0 && checkedCount < leaves.length;
  }

  protected toggleCheck(node: TreeNode, event: Event): void {
    event.stopPropagation();
    if (node.disabled) return;
    const ids = new Set(this.checkedIds());
    const leaves = this.getLeafIds(node);
    const allChecked = leaves.every(id => ids.has(id));
    if (allChecked) {
      leaves.forEach(id => ids.delete(id));
    } else {
      leaves.forEach(id => ids.add(id));
    }
    this.checkedIds.set(ids);
  }
}
