import { Component, OnInit, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { ChampionService } from '../services/champion.service';
import { CommonModule } from '@angular/common';
import { API_BASE_URL } from '../config/api.config';

@Component({
  selector: 'app-user-panel',
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './user-panel.html',
  styleUrl: './user-panel.css',
})
export class UserPanel implements OnInit {
  showChampionManager = signal(false);
  showMatchManager = signal(false);
  
  // Champion fields
  newChampionName = signal('');
  newChampionId = signal('');
  championToDelete = signal('');
  championsFromDB = signal<any[]>([]);
  favoriteChampions = signal<any[]>([]);
  
  // Match fields
  matchDate = signal('');
  matchVersion = signal('');
  matchWinTime = signal('');
  matchApiId = signal('');
  matchWinner = signal<'red' | 'blue'>('red');
  
  // Nowy interfejs - gracze z championami i przedmiotami
  redPlayers = signal<Array<{champion: string, items: number[]}>>([
    {champion: '', items: []},
    {champion: '', items: []},
    {champion: '', items: []},
    {champion: '', items: []},
    {champion: '', items: []}
  ]);
  
  bluePlayers = signal<Array<{champion: string, items: number[]}>>([
    {champion: '', items: []},
    {champion: '', items: []},
    {champion: '', items: []},
    {champion: '', items: []},
    {champion: '', items: []}
  ]);
  
  availableItems = signal<any[]>([]);
  
  summonerName = '';
  region = 'europe';
  matchCount = 20;
  importing = signal(false);
  importResult = signal<any>(null);
  
  randomMatchCount = 50;
  generatingMatches = signal(false);
  generateResult = signal('');

  rawPrzedmiotId = signal('');
  rawPrzedmiotNazwa = signal('');

  rawUserName = signal('');
  rawUserPass = signal('');
  rawUserAdmin = signal(false);

  rawMeczId = signal('');
  rawMeczData = signal('');
  rawMeczWersja = signal('');
  rawMeczCzas = signal('');
  rawMeczWygranaCzerw = signal<boolean | null>(null);
  rawMeczApi = signal('');

  rawUczId = signal('');
  rawUczMeczId = signal('');
  rawUczPostacId = signal('');
  rawUczCzerwoni = signal<boolean | null>(null);
  rawUczPrzedmioty = signal('');

  rawUczPrzedUczId = signal('');
  rawUczPrzedPrzedId = signal('');

  rawUlubUser = signal('');
  rawUlubPostac = signal('');

  reportWinrate = signal<any[]>([]);
  reportTopItems = signal<any[]>([]);
  reportPatches = signal<any[]>([]);
  
  successMessage = signal('');
  errorMessage = signal('');

  constructor(
    public authService: AuthService,
    public championService: ChampionService,
    private router: Router,
    private http: HttpClient
  ) {}

  async ngOnInit() {
    if (!this.authService.isLoggedIn()) {
      this.router.navigate(['/login-page']);
      return;
    }
    
    await this.loadChampions();
    await this.loadFavorites();
    await this.loadAvailableItems();

    if (this.authService.isAdmin()) {
      await this.loadReports();
    }
  }

  async loadChampions() {
    try {
      const champions = await this.championService.getChampionsFromDB();
      this.championsFromDB.set(champions);
    } catch (error) {
      console.error('Failed to load champions:', error);
    }
  }

  async loadFavorites() {
    const user = this.authService.user();
    if (!user) return;

    try {
      const favorites = await this.championService.getFavoriteChampions(user.username);
      
      const favoritesWithIcons = await Promise.all(
        favorites.map(async (champ) => ({
          ...champ,
          icon: await this.championService.getChampionIconById(champ.postac_id)
        }))
      );
      
      this.favoriteChampions.set(favoritesWithIcons);
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  }
  async loadAvailableItems() {
    try {
      const items = await firstValueFrom(
        this.http.get<any[]>(`${API_BASE_URL}/admin/items`)
      );
      this.availableItems.set(items);
    } catch (error) {
      console.error('Failed to load items:', error);
    }
  }

  toggleItemRed(playerIndex: number, itemId: number) {
    const players = this.redPlayers();
    const player = players[playerIndex];
    
    const index = player.items.indexOf(itemId);
    if (index > -1) {
      player.items.splice(index, 1);
    } else {
      if (player.items.length < 6) {
        player.items.push(itemId);
      }
    }
    
    this.redPlayers.set([...players]);
  }

  toggleItemBlue(playerIndex: number, itemId: number) {
    const players = this.bluePlayers();
    const player = players[playerIndex];
    
    const index = player.items.indexOf(itemId);
    if (index > -1) {
      player.items.splice(index, 1);
    } else {
      if (player.items.length < 6) {
        player.items.push(itemId);
      }
    }
    
    this.bluePlayers.set([...players]);
  }

  async removeFavorite(postac_id: number) {
    const user = this.authService.user();
    if (!user) return;

    try {
      await this.championService.removeFavoriteChampion(user.username, postac_id);
      await this.loadFavorites();
      this.showSuccess('Usunięto z ulubionych');
    } catch (error) {
      console.error('Failed to remove favorite:', error);
      this.showError('Nie udało się usunąć z ulubionych');
    }
  }

  toggleChampionManager() {
    this.showChampionManager.set(!this.showChampionManager());
    this.showMatchManager.set(false);
  }

  toggleMatchManager() {
    this.showMatchManager.set(!this.showMatchManager());
    this.showChampionManager.set(false);
  }

  async addChampion() {
    if (!this.newChampionName()) {
      this.showError('Wypełnij pole nazwa');
      return;
    }

    const championId = parseInt(this.newChampionId());
  

    try {
      await this.championService.addChampion(this.newChampionName(), championId);
      this.showSuccess(`Champion ${this.newChampionName()} został dodany!`);
      this.newChampionName.set('');
      this.newChampionId.set('');
      await this.loadChampions();
    } catch (error: any) {
      if (error.status === 401 || error.status === 403) {
        this.showError('Brak uprawnień administratora');
      } else if (error.status === 409) {
        this.showError('Postać o tym ID już istnieje');
      } else {
        this.showError('Nie udało się dodać championa');
      }
    }
  }


  async addMatch() {
    if (!this.matchDate() || !this.matchVersion() || !this.matchWinTime()) {
      this.showError('Wypełnij wszystkie wymagane pola');
      return;
    }

    try {
      // Zbierz championów z nowego interfejsu
      const redChampions = this.redPlayers().map(p => p.champion).filter(c => c);
      const blueChampions = this.bluePlayers().map(p => p.champion).filter(c => c);

      if (redChampions.length !== 5 || blueChampions.length !== 5) {
        this.showError('Każda drużyna musi mieć dokładnie 5 championów');
        return;
      }

      // Zbierz przedmioty
      const redItems = this.redPlayers().map(p => p.items);
      const blueItems = this.bluePlayers().map(p => p.items);

      // Wywołanie API
      await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/add-manual-match`, {
        date: this.matchDate(),
        version: this.matchVersion(),
        gameDuration: parseInt(this.matchWinTime()),
        redChampions,
        blueChampions,
        redItems,
        blueItems,
        redWins: this.matchWinner() === 'red',
        apiId: this.matchApiId()
      }));

      this.showSuccess('Mecz został dodany do bazy danych!');
      this.clearMatchForm();
    } catch (error: any) {
      console.error('Add match error:', error);
      this.showError(error.error?.error || 'Błąd dodawania meczu');
    }
  }

  private clearMatchForm() {
    this.matchDate.set('');
    this.matchVersion.set('');
    this.matchWinTime.set('');
    this.matchApiId.set('');
    this.matchWinner.set('red');
    
    this.redPlayers.set([
      {champion: '', items: []},
      {champion: '', items: []},
      {champion: '', items: []},
      {champion: '', items: []},
      {champion: '', items: []}
    ]);
    
    this.bluePlayers.set([
      {champion: '', items: []},
      {champion: '', items: []},
      {champion: '', items: []},
      {champion: '', items: []},
      {champion: '', items: []}
    ]);
  }

  async importMatches(event: Event) {
    event.preventDefault();
    
    if (!this.summonerName) {
      this.showError('Podaj Riot ID gracza');
      return;
    }
    
    this.importing.set(true);
    this.importResult.set(null);
    
    try {
      const result = await firstValueFrom(
        this.http.post<any>(`${API_BASE_URL}/admin/import-matches`, {
          riotId: this.summonerName,
          region: this.region,
          count: this.matchCount
        })
      );
      
      this.importResult.set(result);
      
      if (result.success) {
        this.summonerName = '';
        this.showSuccess(`Zaimportowano ${result.stats.imported} meczy!`);
      }
    } catch (error: any) {
      console.error('Import error:', error);
      this.importResult.set({
        success: false,
        message: 'Błąd importu: ' + (error.error?.details || error.message)
      });
      this.showError('Błąd importu meczy');
    } finally {
      this.importing.set(false);
    }
  }

  async generateRandomMatches(event: Event) {
    event.preventDefault();
    
    if (!this.randomMatchCount || this.randomMatchCount < 1) {
      this.showError('Podaj liczbę meczy (minimum 1)');
      return;
    }
    
    this.generatingMatches.set(true);
    this.generateResult.set('');
    
    try {
      const result = await firstValueFrom(
        this.http.post<any>(`${API_BASE_URL}/admin/generate-matches`, {
          count: this.randomMatchCount
        })
      );
      
      if (result.success) {
        this.generateResult.set(`✅ Wygenerowano ${result.count} losowych meczy!`);
        this.showSuccess(`Wygenerowano ${result.count} meczy z przedmiotami`);
      }
    } catch (error: any) {
      console.error('Generate error:', error);
      this.generateResult.set('');
      this.showError('Błąd generowania meczy: ' + (error.error?.message || error.message));
    } finally {
      this.generatingMatches.set(false);
    }
  }

  private showSuccess(message: string) {
    this.successMessage.set(message);
    setTimeout(() => this.successMessage.set(''), 3000);
  }

  private showError(message: string) {
    this.errorMessage.set(message);
    setTimeout(() => this.errorMessage.set(''), 3000);
  }

  // --- Surowe inserty ---
  async savePrzedmiot() {
    if (!this.rawPrzedmiotId() || !this.rawPrzedmiotNazwa()) {
      return this.showError('Podaj ID i nazwę przedmiotu');
    }
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/raw/przedmiot`, {
        przedmiot_id: parseInt(this.rawPrzedmiotId()),
        nazwa_przedmiotu: this.rawPrzedmiotNazwa()
      }));
      this.showSuccess('Zapisano przedmiot');
      this.rawPrzedmiotId.set('');
      this.rawPrzedmiotNazwa.set('');
    } catch (e: any) {
      this.showError(e.error?.error || 'Błąd zapisu przedmiotu');
    }
  }

  async saveUser() {
    if (!this.rawUserName() || !this.rawUserPass()) {
      return this.showError('Podaj login i hasło');
    }
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/raw/uzytkownik`, {
        nazwa: this.rawUserName(),
        haslo: this.rawUserPass(),
        czy_admin: this.rawUserAdmin()
      }));
      this.showSuccess('Zapisano użytkownika');
      this.rawUserName.set('');
      this.rawUserPass.set('');
      this.rawUserAdmin.set(false);
    } catch (e: any) {
      this.showError(e.error?.error || 'Błąd zapisu użytkownika');
    }
  }

  async saveMecz() {
    if (!this.rawMeczId()) return this.showError('Podaj mecz_id');
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/raw/mecz`, {
        mecz_id: parseInt(this.rawMeczId()),
        data: this.rawMeczData() || null,
        wersja: this.rawMeczWersja() || null,
        czas_gry: this.rawMeczCzas() || null,
        wygrana_czerwonych: this.rawMeczWygranaCzerw(),
        api_id: this.rawMeczApi() || null
      }));
      this.showSuccess('Zapisano mecz');
      this.rawMeczId.set('');
      this.rawMeczData.set('');
      this.rawMeczWersja.set('');
      this.rawMeczCzas.set('');
      this.rawMeczWygranaCzerw.set(null);
      this.rawMeczApi.set('');
    } catch (e: any) {
      this.showError(e.error?.error || 'Błąd zapisu meczu');
    }
  }

  async saveUczestnik() {
    if (!this.rawUczId() || !this.rawUczMeczId() || !this.rawUczPostacId()) {
      return this.showError('Podaj uczestnik_id, mecz_id, postac_id');
    }
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/raw/uczestnik`, {
        uczestnik_id: parseInt(this.rawUczId()),
        mecz_id: parseInt(this.rawUczMeczId()),
        postac_id: parseInt(this.rawUczPostacId()),
        czy_czerwoni: this.rawUczCzerwoni()
      }));
      this.showSuccess('Zapisano uczestnika');
      this.rawUczId.set('');
      this.rawUczMeczId.set('');
      this.rawUczPostacId.set('');
      this.rawUczCzerwoni.set(null);
    } catch (e: any) {
      this.showError(e.error?.error || 'Błąd zapisu uczestnika');
    }
  }
  async saveUczestnikWithItems() {
    if (!this.rawUczId() || !this.rawUczMeczId() || !this.rawUczPostacId()) {
      return this.showError('Podaj uczestnik_id, mecz_id i postac_id');
    }
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/raw/uczestnik`, {
        uczestnik_id: parseInt(this.rawUczId()),
        mecz_id: parseInt(this.rawUczMeczId()),
        postac_id: parseInt(this.rawUczPostacId()),
        czy_czerwoni: this.rawUczCzerwoni()
      }));

      if (this.rawUczPrzedmioty().trim()) {
        const items = this.rawUczPrzedmioty().split(',').map(id => id.trim()).filter(id => id);
        const uczestnikId = parseInt(this.rawUczId());
        
        for (const itemId of items) {
          await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/raw/uczestnik-przedmiot`, {
            uczestnik_id: uczestnikId,
            przedmiot_id: parseInt(itemId)
          }));
        }
        this.showSuccess(`Zapisano uczestnika i ${items.length} przedmiotów`);
      } else {
        this.showSuccess('Zapisano uczestnika');
      }

      this.rawUczId.set('');
      this.rawUczMeczId.set('');
      this.rawUczPostacId.set('');
      this.rawUczCzerwoni.set(null);
      this.rawUczPrzedmioty.set('');
    } catch (e: any) {
      this.showError(e.error?.error || 'Błąd zapisu uczestnika/przedmiotów');
    }
  }
  async saveUczestnikPrzedmiot() {
    if (!this.rawUczPrzedUczId() || !this.rawUczPrzedPrzedId()) {
      return this.showError('Podaj uczestnik_id i przedmiot_id');
    }
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/raw/uczestnik-przedmiot`, {
        uczestnik_id: parseInt(this.rawUczPrzedUczId()),
        przedmiot_id: parseInt(this.rawUczPrzedPrzedId())
      }));
      this.showSuccess('Zapisano przedmiot uczestnika');
      this.rawUczPrzedUczId.set('');
      this.rawUczPrzedPrzedId.set('');
    } catch (e: any) {
      this.showError(e.error?.error || 'Błąd zapisu przedmiotu uczestnika');
    }
  }

  async saveUlubiona() {
    if (!this.rawUlubUser() || !this.rawUlubPostac()) {
      return this.showError('Podaj użytkownika i postać');
    }
    try {
      await firstValueFrom(this.http.post(`${API_BASE_URL}/admin/raw/ulubiona-postac`, {
        użytkownik_nazwa: this.rawUlubUser(),
        postac_id: parseInt(this.rawUlubPostac())
      }));
      this.showSuccess('Zapisano ulubioną postać');
      this.rawUlubUser.set('');
      this.rawUlubPostac.set('');
    } catch (e: any) {
      this.showError(e.error?.error || 'Błąd zapisu ulubionej postaci');
    }
  }

  async loadReports() {
    try {
      const [win, top, patch] = await Promise.all([
        firstValueFrom(this.http.get<any[]>(`${API_BASE_URL}/admin/reports/winrate`)),
        firstValueFrom(this.http.get<any[]>(`${API_BASE_URL}/admin/reports/top-items`)),
        firstValueFrom(this.http.get<any[]>(`${API_BASE_URL}/admin/reports/patches`))
      ]);
      this.reportWinrate.set(win);
      this.reportTopItems.set(top);
      this.reportPatches.set(patch);
    } catch (e) {
      console.error('Load reports error:', e);
    }
  }
}
