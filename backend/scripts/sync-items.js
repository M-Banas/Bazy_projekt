const axios = require('axios');
const pool = require('../config/database');
require('dotenv').config();

async function syncItems() {
  const client = await pool.connect();
  
  try {
    console.log('Pobieranie listy przedmiotów z Riot API...');
    
    const versionsResponse = await axios.get('https://ddragon.leagueoflegends.com/api/versions.json');
    const latestVersion = versionsResponse.data[0];
    console.log('Najnowsza wersja:', latestVersion);
    
    const itemsResponse = await axios.get(`https://ddragon.leagueoflegends.com/cdn/${latestVersion}/data/pl_PL/item.json`);
    const items = itemsResponse.data.data;
    
    console.log(`Znaleziono ${Object.keys(items).length} przedmiotów z API`);
    
    const validItems = Object.entries(items).filter(([id, item]) => {
      if (item.requiredAlly || item.requiredChampion) return false;
      if (!item.gold || !item.gold.purchasable) return false;
      if (item.maps && item.maps['11'] === false) return false;
      if (item.inStore === false) return false;
      return true;
    });
    
    console.log(`Przedmiotów do synchronizacji: ${validItems.length}`);
    
    await client.query('BEGIN');
    
    const usedItemsResult = await client.query(
      'SELECT DISTINCT przedmiot_id FROM main.uczestnicy_przedmioty'
    );
    const usedItemIds = usedItemsResult.rows.map(r => r.przedmiot_id);
    console.log(`Przedmiotów używanych w meczach: ${usedItemIds.length}`);
    
    if (usedItemIds.length > 0) {
      await client.query(
        'DELETE FROM main.przedmioty WHERE przedmiot_id NOT IN (' + usedItemIds.join(',') + ')'
      );
    } else {
      await client.query('DELETE FROM main.przedmioty');
    }
    console.log('Wyczyszczono starą listę przedmiotów');
    
    let inserted = 0;
    let updated = 0;
    
    for (const [itemId, itemData] of validItems) {
      const id = parseInt(itemId);
      const name = itemData.name;
      
      const result = await client.query(
        `INSERT INTO main.przedmioty (przedmiot_id, nazwa_przedmiotu) 
         VALUES ($1, $2)
         ON CONFLICT (przedmiot_id) 
         DO UPDATE SET nazwa_przedmiotu = $2
         RETURNING (xmax = 0) AS inserted`,
        [id, name]
      );
      
      if (result.rows[0].inserted) {
        inserted++;
      } else {
        updated++;
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\nZakończono!`);
    console.log(`   Dodano: ${inserted} przedmiotów`);
    console.log(`   Zaktualizowano: ${updated} przedmiotów`);
    console.log(`   Razem w bazie: ${inserted + updated} przedmiotów`);
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Błąd podczas synchronizacji przedmiotów:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

syncItems();
