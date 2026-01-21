import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Champion {
  name: string;
  displayName: string;
  icon: string;
}

export interface ChampionWinrate {
  postac_id: number;
  nazwa: string;
  total_games: number;
  wins: number;
  winrate: number;
}

export interface ChampionWinrateHistory {
  patch: string;
  total_games: number;
  wins: number;
  winrate: number;
}

export interface ChampionTopItem {
  przedmiot_id: number;
  nazwa_przedmiotu: string;
  games_count: number;
  wins: number;
  winrate: number;
}

interface ChampionData {
  totalChampions: number;
  champions: Champion[];
  version: string;
  timestamp: string;
}

import { API_BASE_URL } from '../config/api.config';

// Stałe URL API
const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';
const API_VERSIONS_URL = `${DDRAGON_BASE_URL}/api/versions.json`;
const CHAMPION_DATA_PATH = '/data/en_US/champion.json';
const CHAMPION_IMAGES_PATH = '/img/champion/';
const BACKEND_URL = API_BASE_URL;

@Injectable({
  providedIn: 'root'
})
export class ChampionService {
  public data = signal<ChampionData | null>(null);
  public loading = signal(false);
  public error = signal<string | null>(null);
  private championIdMap = signal<Map<number, string>>(new Map());

  constructor(private http: HttpClient) {
    this.loadChampionIdMap();
  }

  // Ładuj mapę ID -> nazwa pliku grafiki
  async loadChampionIdMap() {
    try {
      const version = await this.getLatestDDragonVersion();
      const championsUrl = `${DDRAGON_BASE_URL}/cdn/${version}${CHAMPION_DATA_PATH}`;
      const response = await firstValueFrom(this.http.get<any>(championsUrl));
      
      const map = new Map<number, string>();
      Object.values(response.data).forEach((champ: any) => {
        map.set(parseInt(champ.key), champ.id);
      });
      
      this.championIdMap.set(map);
    } catch (error) {
      console.error('Failed to load champion ID map:', error);
    }
  }

  // Pobierz URL ikony championa po ID
  async getChampionIconById(championId: number): Promise<string> {
    const version = await this.getLatestDDragonVersion();
    const championName = this.championIdMap().get(championId);
    
    if (championName) {
      return `${DDRAGON_BASE_URL}/cdn/${version}${CHAMPION_IMAGES_PATH}${championName}.png`;
    }
    
    // Fallback - ogólny placeholder
    return 'https://via.placeholder.com/120x120/1a1a2e/eaeaea?text=Champion';
  }

  // Pobierz najnowszą wersję DDragon
  async getLatestDDragonVersion(): Promise<string> {
    const versions = await firstValueFrom(this.http.get<string[]>(API_VERSIONS_URL));
    return versions[0];
  }


  // Pobierz dane championów z display names
  async getChampions(): Promise<Champion[]> {
    const version = await this.getLatestDDragonVersion();
    const championsUrl = `${DDRAGON_BASE_URL}/cdn/${version}${CHAMPION_DATA_PATH}`;
    const baseUrl = `${DDRAGON_BASE_URL}/cdn/${version}${CHAMPION_IMAGES_PATH}`;
    
    const response = await firstValueFrom(this.http.get<any>(championsUrl));

    return Object.values(response.data)
      .map((champ: any) => {
        console.log(champ);
        return {
          name: champ.id,
          displayName: champ.name,
          icon: `${baseUrl}${champ.id}.png`
        };
      })
      .sort((a, b) => a.displayName.localeCompare(b.displayName));
  }

  // Główna funkcja - pobierz dane i zwróć JSON
  async fetchAllData(): Promise<ChampionData> {
    try {
      this.loading.set(true);
      this.error.set(null);

      const champions = await this.getChampions();
      const version = await this.getLatestDDragonVersion();

      const data: ChampionData = {
        totalChampions: champions.length,
        champions: champions,
        version: version,
        timestamp: new Date().toISOString()
      };

      // Udostępnij jako właściwość publiczną
      this.data.set(data);

      return data;
    } catch (err: any) {
      const errorMsg = err.message || 'Nieznany błąd';
      this.error.set(errorMsg);
      throw err;
    } finally {
      this.loading.set(false);
    }
  }

  // Pobierz winrate dla championsa
  async getChampionWinrate(championId: number, patch?: string): Promise<ChampionWinrate> {
    let url = `${BACKEND_URL}/postaci/${championId}/winrate`;
    if (patch) {
      url += `?patch=${patch}`;
    }
    return await firstValueFrom(this.http.get<ChampionWinrate>(url));
  }

  // Pobierz historię winrate po patchach
  async getChampionWinrateHistory(championId: number): Promise<ChampionWinrateHistory[]> {
    const url = `${BACKEND_URL}/postaci/${championId}/winrate-history`;
    return await firstValueFrom(this.http.get<ChampionWinrateHistory[]>(url));
  }

  // Dodaj nowego championa (tylko admin)
  async addChampion(nazwa: string, postac_id: number): Promise<any> {
    const url = `${BACKEND_URL}/postaci`;
    return await firstValueFrom(this.http.post<any>(url, { nazwa, postac_id }));
  }

  // Usuń championa (tylko admin)
  async deleteChampion(postac_id: number): Promise<any> {
    const url = `${BACKEND_URL}/postaci/${postac_id}`;
    return await firstValueFrom(this.http.delete<any>(url));
  }

  // Pobierz listę championów z backendu (nie z DDragon)
  async getChampionsFromDB(): Promise<any[]> {
    const url = `${BACKEND_URL}/postaci`;
    return await firstValueFrom(this.http.get<any[]>(url));
  }

  // Pobierz ulubione postaci użytkownika
  async getFavoriteChampions(username: string): Promise<any[]> {
    const url = `${BACKEND_URL}/postaci/favorites/${username}`;
    return await firstValueFrom(this.http.get<any[]>(url));
  }

  // Dodaj postać do ulubionych
  async addFavoriteChampion(username: string, postac_id: number): Promise<any> {
    const url = `${BACKEND_URL}/postaci/favorites`;
    return await firstValueFrom(this.http.post<any>(url, { username, postac_id }));
  }

  // Usuń postać z ulubionych
  async removeFavoriteChampion(username: string, postac_id: number): Promise<any> {
    const url = `${BACKEND_URL}/postaci/favorites/${username}/${postac_id}`;
    return await firstValueFrom(this.http.delete<any>(url));
  }

  // Pobierz najlepsze przedmioty po winrate dla postaci
  async getTopItems(championId: number, patch?: string): Promise<ChampionTopItem[]> {
    let url = `${BACKEND_URL}/postaci/${championId}/top-items`;
    
    if (patch) {
      url += `?patch=${encodeURIComponent(patch)}`;
    }
    
    return await firstValueFrom(this.http.get<ChampionTopItem[]>(url));
  }

  // Pobierz dostępne patche/wersje gry
  async getPatches(): Promise<string[]> {
    const url = `${BACKEND_URL}/postaci/patches`;
    return await firstValueFrom(this.http.get<string[]>(url));
  }

  // Pobierz URL ikony przedmiotu z DDragon
  async getItemIcon(itemId: number): Promise<string> {
    const version = await this.getLatestDDragonVersion();
    return `${DDRAGON_BASE_URL}/cdn/${version}/img/item/${itemId}.png`;
  }

  // Pobierz nazwę przedmiotu - najpierw z bazy danych (polskie nazwy), potem z DDragon API
  async getItemName(itemId: number): Promise<string> {
    try {
      // Najpierw spróbuj pobrać z bazy danych (gdzie są polskie nazwy)
      const dbUrl = `${BACKEND_URL}/admin/items`;
      const items = await firstValueFrom(this.http.get<any[]>(dbUrl));
      const item = items.find(i => i.przedmiot_id === itemId);
      
      if (item && item.nazwa_przedmiotu) {
        return item.nazwa_przedmiotu;
      }
      
      // Fallback: pobierz z DDragon API w języku polskim
      const version = await this.getLatestDDragonVersion();
      const itemsUrl = `${DDRAGON_BASE_URL}/cdn/${version}/data/pl_PL/item.json`;
      const response = await firstValueFrom(this.http.get<any>(itemsUrl));
      
      if (response.data[itemId]) {
        return response.data[itemId].name;
      }
      return `Przedmiot ${itemId}`;
    } catch (error) {
      console.error('Failed to fetch item name:', error);
      return `Przedmiot ${itemId}`;
    }
  }
}
