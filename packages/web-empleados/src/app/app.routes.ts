import { Routes } from '@angular/router';
import { LoginComponent } from '@resttek/web-shared';
import { ShellComponent } from './core/layout/shell.component';
import { authGuard, roleGuard } from '@resttek/web-shared';

const HOME_BY_ROLE = { cocinero: '/cocina', manager: '/cocina', camarero: '/barra' };

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('@resttek/web-shared').then(m => m.LoginComponent)
  },
  {
    path: '',
    component: ShellComponent,
    canActivate: [authGuard],
    children: [
      {
        path: '',
        redirectTo: 'cocina',
        pathMatch: 'full'
      },
      {
        path: 'cocina',
        canActivate: [roleGuard],
        data: { roles: ['cocinero', 'manager'], homeByRole: HOME_BY_ROLE },
        loadComponent: () => import('./features/orders/pages/cocina/cocina.component').then(m => m.CocinaComponent),
      },
      {
        path: 'barra',
        canActivate: [roleGuard],
        data: { roles: ['camarero', 'manager'], homeByRole: HOME_BY_ROLE },
        loadComponent: () => import('./features/orders/pages/barra/barra.component').then(m => m.BarraComponent),
      },
      {
        path: 'salon',
        canActivate: [roleGuard],
        data: { roles: ['camarero', 'manager'], homeByRole: HOME_BY_ROLE },
        loadComponent: () => import('./features/orders/pages/salon/salon.component').then(m => m.SalonComponent),
      }
    ]
  },
  {
    path: '**',
    loadComponent: () => import('./core/layout/not-found.component').then(m => m.NotFoundComponent)
  }
];
