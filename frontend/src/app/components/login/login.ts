import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginService } from '../../services/login.service';
import { AuthService } from '../../services/auth.service';
import { PkIcon } from '../../shares/pk-icon';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, PkIcon],
  templateUrl: './login.html',
  styleUrl: './login.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Login {
  private readonly formBuilder = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly loginService = inject(LoginService);
  private readonly auth = inject(AuthService);

  protected readonly form = this.formBuilder.nonNullable.group({
    username: ['', [Validators.required]],
    password: ['', [Validators.required]],
  });

  protected readonly loading = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected async onSubmit(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    const { username, password } = this.form.getRawValue();

    try {
      await this.loginService.login(username, password);
      this.auth.refresh();
      this.router.navigateByUrl('/about');
    } catch (err: any) {
      if (err instanceof HttpErrorResponse) {
        const msg = err.error?.message || err?.message || 'Login failed';
        this.errorMessage.set(typeof msg === 'string' ? msg : 'Login failed');
      } else {
        this.errorMessage.set('Cannot connect to API gateway');
      }
    } finally {
      this.loading.set(false);
    }
  }
}
