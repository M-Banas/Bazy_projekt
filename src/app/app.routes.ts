import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { ChampionStats } from './champion-stats/champion-stats';
import { LoginPage } from './login-page/login-page';
import { RegisterPage } from './register-page/register-page';
import { UserPanel } from './user-panel/user-panel';

export const routes: Routes = [
  {
    path: '',
    component: Dashboard
  },
  {
    path: 'champion/:id',
    component: ChampionStats
  },
  {
    path: 'login',
    component: LoginPage
  },
  {
    path: 'register',
    component: RegisterPage
  },
  {
    path: 'panel',
    component: UserPanel
  },
  // Stara ścieżka dla kompatybilności
  {
    path: 'login-page',
    redirectTo: 'login',
    pathMatch: 'full'
  }
];
