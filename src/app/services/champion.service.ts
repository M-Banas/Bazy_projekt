import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

export interface Champion {
  name: string;
  displayName: string;
  icon: string;
}

interface ChampionData {
  totalChampions: number;
  champions: Champion[];
  version: string;
  timestamp: string;
}

// Stałe URL API
const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';
const API_VERSIONS_URL = `${DDRAGON_BASE_URL}/api/versions.json`;
const CHAMPION_DATA_PATH = '/data/en_US/champion.json';
const CHAMPION_IMAGES_PATH = '/img/champion/';

@Injectable({
  providedIn: 'root'
})
export class ChampionService {
  public data = signal<ChampionData | null>(null);
  public loading = signal(false);
  public error = signal<string | null>(null);

  constructor(private http: HttpClient) {}

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
}
