import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ChampionService } from '../services/champion.service';
import { Champion } from '../services/champion.service';

@Component({
  standalone: true,
  selector: 'app-champion-stats',
  imports: [RouterLink],
  templateUrl: './champion-stats.html',
  styleUrl: './champion-stats.css',
})
export class ChampionStats implements OnInit {
  champion = signal<Champion | null>(null);
  loading = signal(true);

  constructor(
    private route: ActivatedRoute,
    private championService: ChampionService
  ) {}

  ngOnInit() {
    this.route.params.subscribe(params => {
      const championId = params['id'];
      const data = this.championService.data();

      if (data) {
        const found = data.champions.find(c => c.name === championId);
        this.champion.set(found || null);
      }

      this.loading.set(false);
    });
  }
}
