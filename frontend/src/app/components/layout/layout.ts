import { ChangeDetectionStrategy, Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PkIcon } from '../../shares/pk-icon';
import config from '../../configs/config';
import { ThemeService } from '../../services/theme.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, PkIcon],
  templateUrl: './layout.html',
  styleUrl: './layout.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Layout implements OnInit, OnDestroy {
  private readonly router = inject(Router);
  protected readonly themeService = inject(ThemeService);
  protected readonly auth = inject(AuthService);
  protected readonly appName = config.appName;

  ngOnInit(): void {
    this.auth.startExpiryWatch(() => this.router.navigateByUrl('/login'));
  }

  ngOnDestroy(): void {
    this.auth.stopExpiryWatch();
  }

  protected logout(): void {
    sessionStorage.removeItem(config.tokenName);
    this.auth.clear();
    this.router.navigateByUrl('/login');
  }
}
