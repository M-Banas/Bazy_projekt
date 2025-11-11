import { Routes } from '@angular/router';
import { Dashboard } from './dashboard/dashboard';
import { ChampionStats } from './champion-stats/champion-stats';

export const routes: Routes = [
  {
    path: '',
    component: Dashboard
  },
  {
    path: 'champion/:id',
    component: ChampionStats
  }
];
