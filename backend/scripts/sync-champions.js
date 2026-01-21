const axios = require('axios');
const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';
const API_VERSIONS_URL = `${DDRAGON_BASE_URL}/api/versions.json`;
const CHAMPION_DATA_PATH = '/data/en_US/champion.json';

async function syncChampions() {
  try {
    console.log('Pobieranie najnowszej wersji...');
    const versionsResponse = await axios.get(API_VERSIONS_URL);
    const latestVersion = versionsResponse.data[0];
    console.log(`Wersja: ${latestVersion}`);
    
    console.log('Pobieranie danych championów...');
    const championsUrl = `${DDRAGON_BASE_URL}/cdn/${latestVersion}${CHAMPION_DATA_PATH}`;
    const championsResponse = await axios.get(championsUrl);
    const championsData = championsResponse.data.data;
    
    let inserted = 0;
    let skipped = 0;
    
    console.log(`Znaleziono ${Object.keys(championsData).length} championów`);
    
    for (const [key, champion] of Object.entries(championsData)) {
      try {
        const existing = await pool.query(
          'SELECT postac_id FROM main.postaci WHERE nazwa = $1',
          [champion.name]
        );
        
        if (existing.rows.length === 0) {
          await pool.query(
            'INSERT INTO main.postaci (nazwa, postac_id) VALUES ($1, $2)',
            [champion.name, parseInt(champion.key)]
          );
          console.log(`Dodano: ${champion.name} (ID: ${champion.key})`);
          inserted++;
        } else {
          console.log(`Pominięto: ${champion.name} (już istnieje)`);
          skipped++;
        }
      } catch (err) {
        console.error(`Błąd dodawania ${champion.name}:`, err.message);
      }
    }
    
    console.log('\n=== PODSUMOWANIE ===');
    console.log(`Dodano: ${inserted}`);
    console.log(`Pominięto: ${skipped}`);
    console.log(`Razem: ${Object.keys(championsData).length}`);
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('Błąd synchronizacji:', error);
    await pool.end();
    process.exit(1);
  }
}

syncChampions();
