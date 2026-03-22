import { CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import config from '../configs/config';

function isTokenValid(token: string): boolean {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return typeof payload.exp === 'number' && payload.exp * 1000 > Date.now();
  } catch {
    return false;
  }
}

export const guestGuard: CanActivateFn = () => {
  const router = inject(Router);
  const token = sessionStorage.getItem(config.tokenName);

  if (token && isTokenValid(token)) {
    return router.createUrlTree(['/monitor']);
  }

  sessionStorage.removeItem(config.tokenName);
  return true;
};
