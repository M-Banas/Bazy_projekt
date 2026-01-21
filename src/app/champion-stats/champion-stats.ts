import { Component, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChampionService, ChampionTopItem } from '../services/champion.service';
import { Champion } from '../services/champion.service';

@Component({
  standalone: true,
  selector: 'app-champion-stats',
  imports: [CommonModule, FormsModule],
  templateUrl: './champion-stats.html',
  styleUrl: './champion-stats.css',
})
export class ChampionStats implements OnInit {
  champion = signal<Champion | null>(null);
  loading = signal(true);
  selectedPatch = signal<string>('all'); // 'all' oznacza wszystkie patche
  patches = signal<string[]>([]);
  currentChampionId = signal<number | null>(null);
  
  // Dane z backendu
  winrateData = signal<any>(null);
  winrateLoading = signal(false);
  winrateHistory = signal<any[]>([]);
  
  // Top przedmioty
  topItems = signal<{ item: ChampionTopItem, icon: string, name: string }[]>([]);
  topItemsLoading = signal(false);
  showAllItems = signal(false); // Stan rozwinięcia listy przedmiotów
  allItems = signal<{ item: ChampionTopItem, icon: string, name: string }[]>([]); // Wszystkie przedmioty

  constructor(
    private route: ActivatedRoute,
    private championService: ChampionService
  ) {}

  async ngOnInit() {
    // Pobierz dostępne patche
    try {
      const patches = await this.championService.getPatches();
      this.patches.set(patches);
      // Domyślnie "all" - pokazuj statystyki ze wszystkich patchy
    } catch (err) {
      console.error('Błąd pobierania patchy:', err);
    }

    this.route.params.subscribe(async params => {
      const championId = parseInt(params['id']); // Teraz to jest ID numeryczne
      this.currentChampionId.set(championId);
      
      // Pobierz dane championa z backendu
      try {
        this.loading.set(true);
        
        // Pobierz wszystkich championów z DB
        const champions = await this.championService.getChampionsFromDB();
        const found = champions.find(c => c.postac_id === championId);
        
        if (found) {
          // Ustaw championa z dodatkową ikoną
          const icon = await this.championService.getChampionIconById(championId);
          this.champion.set({
            name: found.nazwa,
            displayName: found.nazwa,
            icon: icon
          });
          
          // Pobierz winrate z backendu
          this.fetchWinrate(championId, this.selectedPatch() === 'all' ? undefined : this.selectedPatch());
          this.fetchWinrateHistory(championId);
          this.fetchTopItems(championId, this.selectedPatch() === 'all' ? undefined : this.selectedPatch());
        } else {
          this.champion.set(null);
        }
      } catch (err) {
        console.error('Błąd ładowania danych:', err);
      } finally {
        this.loading.set(false);
      }
    });
  }

  async fetchWinrate(championId: number, patch?: string) {
    this.winrateLoading.set(true);
    try {
      const data = await this.championService.getChampionWinrate(championId, patch);
      this.winrateData.set(data);
    } catch (err) {
      console.error('Błąd pobierania winrate:', err);
    } finally {
      this.winrateLoading.set(false);
    }
  }

  async fetchWinrateHistory(championId: number) {
    try {
      const history = await this.championService.getChampionWinrateHistory(championId);
      this.winrateHistory.set(history);
    } catch (err) {
      console.error('Błąd pobierania historii winrate:', err);
    }
  }

  async fetchTopItems(championId: number, patch?: string) {
    this.topItemsLoading.set(true);
    try {
      // Pobierz wszystkie przedmioty
      const allItemsData = await this.championService.getTopItems(championId, patch);
      
      // Weź top 3 przedmioty
      const top3Items = allItemsData.slice(0, 3);
      
      // Pobierz ikony i nazwy dla top 3
      const top3WithIconsAndNames = await Promise.all(
        top3Items.map(async (item) => ({
          item,
          icon: await this.championService.getItemIcon(item.przedmiot_id),
          name: await this.championService.getItemName(item.przedmiot_id)
        }))
      );
      
      // Pobierz ikony i nazwy dla wszystkich
      const allWithIconsAndNames = await Promise.all(
        allItemsData.map(async (item) => ({
          item,
          icon: await this.championService.getItemIcon(item.przedmiot_id),
          name: await this.championService.getItemName(item.przedmiot_id)
        }))
      );
      
      this.topItems.set(top3WithIconsAndNames);
      this.allItems.set(allWithIconsAndNames);
      this.showAllItems.set(false); // Reset do pokazywania tylko top 3
    } catch (err) {
      console.error('Błąd pobierania top przedmiotów:', err);
    } finally {
      this.topItemsLoading.set(false);
    }
  }

  toggleShowAllItems() {
    this.showAllItems.set(!this.showAllItems());
  }

  // Zwraca przedmioty do wyświetlenia (top 3 lub wszystkie)
  getDisplayedItems() {
    return this.showAllItems() ? this.allItems() : this.topItems();
  }

  onPatchChange(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedPatch.set(target.value);
    
    const championId = this.currentChampionId();
    if (championId) {
      // Pobierz winrate dla nowego patcha
      const patch = target.value === 'all' ? undefined : target.value;
      this.fetchWinrate(championId, patch);
      this.fetchTopItems(championId, patch);
    }
  }

  calculateProgress(percentage: number): number {
    const circumference = 2 * Math.PI * 40; // 251.2
    return (percentage / 100) * circumference;
  }
}
