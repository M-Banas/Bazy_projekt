import { Component } from '@angular/core';
import { ChampionList } from '../champion-list/champion-list';

@Component({
  standalone: true,
  selector: 'app-dashboard',
  imports: [ChampionList],
  templateUrl: './dashboard.html',
  styleUrl: './dashboard.css',
})
export class Dashboard {}
