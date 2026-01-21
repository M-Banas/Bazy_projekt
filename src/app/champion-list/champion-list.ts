import { Component, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ChampionService } from '../services/champion.service';
import { AuthService } from '../services/auth.service';
import { CommonModule } from '@angular/common';

@Component({
  standalone: true,
  selector: 'app-champion-list',
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './champion-list.html',
  styleUrl: './champion-list.css',
})
export class ChampionList implements OnInit {
  searchQuery = signal('');
  championsFromDB = signal<any[]>([]);
  loading = signal(true);
  favoriteIds = signal<Set<number>>(new Set());

  filteredChampions = computed(() => {
    const champions = this.championsFromDB();
    const query = this.searchQuery().toLowerCase();

    if (!champions.length) return [];
    if (!query) return champions;

    return champions.filter(champ =>
      champ.nazwa.toLowerCase().includes(query)
    );
  });

  blad() {
    alert('dd')
  }

  constructor(
    public championService: ChampionService,
    public authService: AuthService
  ) {}

  async ngOnInit() {
    await this.loadChampions();
    await this.loadFavorites();
  }

  async loadChampions() {
    try {
      this.loading.set(true);
      const champions = await this.championService.getChampionsFromDB();
      
      // Dodaj ikony do championów
      const championsWithIcons = await Promise.all(
        champions.map(async (champ) => ({
          ...champ,
          icon: await this.championService.getChampionIconById(champ.postac_id)
        }))
      );
      
      this.championsFromDB.set(championsWithIcons);
    } catch (error) {
      console.error('Failed to load champions:', error);
    } finally {
      this.loading.set(false);
    }
  }

  async loadFavorites() {
    const user = this.authService.user();
    if (!user) return;

    try {
      const favorites = await this.championService.getFavoriteChampions(user.username);
      this.favoriteIds.set(new Set(favorites.map(f => f.postac_id)));
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  }

  isFavorite(postac_id: number): boolean {
    return this.favoriteIds().has(postac_id);
  }

  async toggleFavorite(event: Event, postac_id: number) {
    event.preventDefault();
    event.stopPropagation();
    
    const user = this.authService.user();
    if (!user) {
      alert('Musisz być zalogowany, aby dodać ulubione postaci');
      return;
    }

    console.log('Toggle favorite - user:', user);
    console.log('Toggle favorite - user:', localStorage.getItem('currentUser'));

    try {
      if (this.isFavorite(postac_id)) {
        await this.championService.removeFavoriteChampion(user.username, postac_id);
        const newFavorites = new Set(this.favoriteIds());
        newFavorites.delete(postac_id);
        this.favoriteIds.set(newFavorites);
      } else {
        await this.championService.addFavoriteChampion(user.username, postac_id);
        const newFavorites = new Set(this.favoriteIds());
        newFavorites.add(postac_id);
        this.favoriteIds.set(newFavorites);
      }
    } catch (error: any) {
      console.error('Failed to toggle favorite:', error);
      console.error('Error status:', error?.status);
      console.error('Error message:', error?.error);
      alert('Nie udało się zaktualizować ulubionych: ' + (error?.error?.error || error?.message || 'Nieznany błąd'));
    }
  }
}
