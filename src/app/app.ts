import { Component, signal, OnInit } from '@angular/core';
import { Router, RouterOutlet, RouterLink } from '@angular/router';
import { HttpClientModule } from '@angular/common/http';
import { ChampionService } from './services/champion.service';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, HttpClientModule, RouterLink],
  providers: [ChampionService],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit {
  protected readonly title = signal('test');

  constructor(
    public championService: ChampionService,
    public authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    try {
      await this.championService.fetchAllData();
      console.log('Dane championów załadowane');
    } catch (err: any) {
      console.error('Błąd:', err);
    }
  }

  onLogin() {
    this.router.navigate(['/login-page']);
  }

  onLogout() {
    this.authService.logout();
    this.router.navigate(['/']);
  }
}
