import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { PkToastrService } from './pk-toastr.service';

const ICON: Record<string, string> = {
  success: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M6.5 10.5l2.5 2.5 4-5"/></svg>`,
  error:   `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M7 7l6 6M13 7l-6 6"/></svg>`,
  warning: `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.13 3.4L2.2 15.5A1 1 0 0 0 3.07 17h13.86a1 1 0 0 0 .87-1.5L10.87 3.4a1 1 0 0 0-1.74 0z"/><path d="M10 8.5v3.5M10 14.5h.01"/></svg>`,
  info:    `<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="10" cy="10" r="8"/><path d="M10 9v5M10 6.5h.01"/></svg>`,
};

@Component({
  selector: 'pk-toastr',
  templateUrl: './pk-toastr.html',
  styleUrl: './pk-toastr.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PkToastr {
  protected readonly svc = inject(PkToastrService);
  protected readonly icon = ICON;
}
