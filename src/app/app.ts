import { Component, signal, OnInit } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { ChampionList } from './champion-list/champion-list';
import { ChampionService } from './services/champion.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, HttpClientModule, ChampionList],
  providers: [ChampionService],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('test');

  constructor(public championService: ChampionService) {}

  async ngOnInit() {
    try {
      await this.championService.fetchAllData();
      console.log('✅ Dane championów załadowane');
    } catch (err: any) {
      console.error('❌ Błąd:', err);
    }
  }
}
