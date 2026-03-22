import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Location } from '@angular/common';
import { Router, RouterLink } from '@angular/router';

@Component({
  selector: 'app-page-not-found',
  imports: [RouterLink],
  templateUrl: './page-not-found.html',
  styleUrl: './page-not-found.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PageNotFound {
  private readonly location = inject(Location);
  protected readonly router = inject(Router);

  protected readonly attemptedUrl = this.router.url;

  protected goBack(): void {
    this.location.back();
  }
}
