import { Component, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChampionService } from '../services/champion.service';
import { dateTimestampProvider } from 'rxjs/internal/scheduler/dateTimestampProvider';
import { DatePipe } from '@angular/common';
import { JsonPipe } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-champion-list',
  imports: [FormsModule, RouterLink, DatePipe, JsonPipe],
  templateUrl: './champion-list.html',
  styleUrl: './champion-list.css',
})
export class ChampionList {
  searchQuery = signal('');

  filteredChampions = computed(() => {
    const data = this.championService.data();
    const query = this.searchQuery().toLowerCase();

    if (!data) return [];
    if (!query) return data.champions;

    return data.champions.filter(champ =>
      champ.displayName.toLowerCase().includes(query) ||
      champ.name.toLowerCase().includes(query)
    );
  });

  constructor(public championService: ChampionService) {}
}
