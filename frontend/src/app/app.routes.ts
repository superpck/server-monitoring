import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { guestGuard } from './guards/guest.guard';
import { adminGuard } from './guards/admin.guard';

export const routes: Routes = [
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./components/login/login').then((m) => m.Login),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./components/layout/layout').then((m) => m.Layout),
    children: [
      {
        path: 'server-management',
        loadComponent: () => import('./components/server-management/server-management').then((m) => m.ServerManagement),
      },
      {
        path: 'monitor',
        loadComponent: () => import('./components/server-monitor/server-monitor').then((m) => m.ServerMonitor),
      },
      {
        path: 'db-monitor',
        loadComponent: () => import('./components/db-monitor/db-monitor').then((m) => m.DbMonitor),
      },
      {
        path: 'server-config',
        canActivate: [adminGuard],
        loadComponent: () => import('./components/server-config/server-config').then((m) => m.ServerConfig),
      },
      {
        path: 'alive',
        loadComponent: () => import('./components/alive/alive').then((m) => m.Alive),
      },
      {
        path: 'about',
        loadComponent: () => import('./components/about/about').then((m) => m.About),
      },
      {
        path: '404',
        loadComponent: () => import('./components/page-not-found/page-not-found').then((m) => m.PageNotFound),
      },
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'server-management',
      },
      {
        path: '**',
        redirectTo: '/404',
      },
    ],
  },
  {
    path: '**',
    redirectTo: '404',
  },
];
