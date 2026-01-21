const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');

const RIOT_API_KEY = process.env.RIOT_API_KEY || 'RGAPI-YOUR-KEY-HERE';
const RIOT_BASE_URL = 'https://europe.api.riotgames.com';
const RIOT_REGION_URL = 'https://eun1.api.riotgames.com';

router.post('/import-matches', async (req, res) => {
  try {
    const { riotId, region = 'eun1', count = 20 } = req.body;
    
    if (!riotId) {
      return res.status(400).json({ error: 'Riot ID jest wymagane (format: Nazwa#TAG)' });
    }
    
    const riotIdParts = riotId.split('#');
    if (riotIdParts.length !== 2) {
      return res.status(400).json({ error: 'Nieprawidłowy format Riot ID. Użyj formatu: Nazwa#TAG' });
    }
    
    const [gameName, tagLine] = riotIdParts;
    console.log(`Importowanie meczy dla: ${gameName}#${tagLine}, region: ${region}, liczba: ${count}`);
    console.log(`Riot API Key: ${RIOT_API_KEY.substring(0, 10)}...`);
    
    const routingMap = {
      'eun1': 'europe',
      'euw1': 'europe',
      'tr1': 'europe',
      'ru': 'europe',
      'na1': 'americas',
      'br1': 'americas',
      'la1': 'americas',
      'la2': 'americas',
      'kr': 'asia',
      'jp1': 'asia',
      'oc1': 'asia',
      'ph2': 'asia',
      'sg2': 'asia',
      'th2': 'asia',
      'tw2': 'asia',
      'vn2': 'asia'
    };
    
    const routingValue = routingMap[region] || 'europe';
    const accountUrl = `https://${routingValue}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
    console.log(`Requesting account data from: ${accountUrl}`);
    
    let accountResponse;
    try {
      accountResponse = await axios.get(accountUrl, {
        headers: { 'X-Riot-Token': RIOT_API_KEY }
      });
    } catch (axiosError) {
      console.error('Riot API Error:', axiosError.response?.status, axiosError.response?.data);
      return res.status(axiosError.response?.status || 500).json({ 
        error: 'Riot API Error',
        details: axiosError.response?.data?.status?.message || 'Błąd komunikacji z Riot API. Sprawdź czy klucz API jest aktywny i Riot ID jest poprawne.',
        riotStatus: axiosError.response?.status
      });
    }
    
    const puuid = accountResponse.data.puuid;
    console.log(`PUUID: ${puuid}`);
    
    const matchListUrl = `${RIOT_BASE_URL}/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
    const matchListResponse = await axios.get(matchListUrl, {
      headers: { 'X-Riot-Token': RIOT_API_KEY }
    });
    
    const matchIds = matchListResponse.data;
    console.log(`Znaleziono ${matchIds.length} meczy`);
    
    let importedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;
    
    for (const matchId of matchIds) {
      try {
        const existingMatch = await pool.query(
          'SELECT mecz_id FROM main.mecze WHERE api_id = $1',
          [matchId]
        );
        
        if (existingMatch.rows.length > 0) {
          console.log(`Mecz ${matchId} już istnieje, pomijam...`);
          skippedCount++;
          continue;
        }
        
        const matchUrl = `${RIOT_BASE_URL}/lol/match/v5/matches/${matchId}`;
        const matchResponse = await axios.get(matchUrl, {
          headers: { 'X-Riot-Token': RIOT_API_KEY }
        });
        
        const matchData = matchResponse.data;
        
        await saveMatchToDatabase(matchData);
        importedCount++;
        console.log(`Zaimportowano mecz ${matchId}`);
        
        await new Promise(resolve => setTimeout(resolve, 1200));
        
      } catch (err) {
        console.error(`Błąd importu meczu ${matchId}:`, err.message);
        errorCount++;
      }
    }
    
    res.json({
      success: true,
      message: `Import zakończony`,
      stats: {
        imported: importedCount,
        skipped: skippedCount,
        errors: errorCount,
        total: matchIds.length
      }
    });
    
  } catch (error) {
    console.error('Import matches error:', error);
    res.status(500).json({ 
      error: 'Failed to import matches',
      details: error.message 
    });
  }
});

router.get('/items', async (_req, res) => {
  try {
    const result = await pool.query(
      'SELECT przedmiot_id, nazwa_przedmiotu FROM main.przedmioty ORDER BY nazwa_przedmiotu'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Get items error:', error);
    res.status(500).json({ error: 'Nie udało się pobrać przedmiotów' });
  }
});

router.post('/add-manual-match', async (req, res) => {
  const client = await pool.connect();
  
  try {
    const { date, version, gameDuration, redChampions, blueChampions, redItems, blueItems, redWins, apiId } = req.body;
    
    if (!redChampions || !blueChampions || redChampions.length !== 5 || blueChampions.length !== 5) {
      return res.status(400).json({ error: 'Każda drużyna musi mieć 5 championów' });
    }

    await client.query('BEGIN');
    
    const lastMatchResult = await client.query('SELECT COALESCE(MAX(mecz_id), 0) as last_id FROM main.mecze');
    const lastParticipantResult = await client.query('SELECT COALESCE(MAX(uczestnik_id), 0) as last_id FROM main.uczestnicy_meczow');
    
    const matchId = lastMatchResult.rows[0].last_id + 1;
    let participantId = lastParticipantResult.rows[0].last_id;
    
    const redWon = redWins !== undefined ? redWins : Math.random() > 0.5;
    const gameDate = date ? new Date(date) : new Date();
    
    await client.query(
      `INSERT INTO main.mecze (mecz_id, data, wersja, czas_gry, wygrana_czerwonych, api_id) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [matchId, gameDate, version, gameDuration, redWon, apiId || null]
    );
    
    const getChampionId = async (championName) => {
      const result = await client.query(
        'SELECT postac_id FROM main.postaci WHERE LOWER(nazwa) = LOWER($1)',
        [championName]
      );
      if (result.rows.length === 0) {
        throw new Error(`Champion nie znaleziony: ${championName}`);
      }
      return result.rows[0].postac_id;
    };
    
    for (let i = 0; i < redChampions.length; i++) {
      participantId++;
      const championId = await getChampionId(redChampions[i]);
      
      await client.query(
        'INSERT INTO main.uczestnicy_meczow (uczestnik_id, mecz_id, postac_id, czy_czerwoni) VALUES ($1, $2, $3, $4)',
        [participantId, matchId, championId, true]
      );
      
      if (redItems && redItems[i] && redItems[i].length > 0) {
        for (const itemId of redItems[i]) {
          if (itemId) {
            await client.query(
              'INSERT INTO main.uczestnicy_przedmioty (uczestnik_id, przedmiot_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [participantId, parseInt(itemId)]
            );
          }
        }
      }
    }
    
    for (let i = 0; i < blueChampions.length; i++) {
      participantId++;
      const championId = await getChampionId(blueChampions[i]);
      
      await client.query(
        'INSERT INTO main.uczestnicy_meczow (uczestnik_id, mecz_id, postac_id, czy_czerwoni) VALUES ($1, $2, $3, $4)',
        [participantId, matchId, championId, false]
      );
      
      if (blueItems && blueItems[i] && blueItems[i].length > 0) {
        for (const itemId of blueItems[i]) {
          if (itemId) {
            await client.query(
              'INSERT INTO main.uczestnicy_przedmioty (uczestnik_id, przedmiot_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [participantId, parseInt(itemId)]
            );
          }
        }
      }
    }
    
    await client.query('COMMIT');
    res.json({ message: 'Mecz dodany pomyślnie', matchId });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Manual match error:', error);
    res.status(500).json({ error: error.message || 'Błąd dodawania meczu' });
  } finally {
    client.release();
  }
});

async function saveMatchToDatabase(matchData) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const info = matchData.info;
    const metadata = matchData.metadata;
    
    const lastMatchResult = await client.query('SELECT COALESCE(MAX(mecz_id), 0) as last_id FROM main.mecze');
    const lastParticipantResult = await client.query('SELECT COALESCE(MAX(uczestnik_id), 0) as last_id FROM main.uczestnicy_meczow');
    
    const matchId = lastMatchResult.rows[0].last_id + 1;
    let participantId = lastParticipantResult.rows[0].last_id + 1;
    
    // Wstaw mecz
    const gameDate = new Date(info.gameCreation);
    const gameDuration = Math.floor(info.gameDuration / 60) + ':' + (info.gameDuration % 60).toString().padStart(2, '0');
    const patch = info.gameVersion.split('.').slice(0, 2).join('.'); // np. "14.1"
    
    await client.query(
      `INSERT INTO main.mecze (mecz_id, data, wersja, czas_gry, wygrana_czerwonych, api_id) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [matchId, gameDate, patch, gameDuration, info.teams[0].win, metadata.matchId]
    );
    
    for (const participant of info.participants) {

      
      if (championResult.rows.length === 0) {
        await client.query(
          'INSERT INTO main.postaci (postac_id, nazwa) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [participant.championId, participant.championName]
        );
      }
      
      const isRed = participant.teamId === 100; // 100 = blue, 200 = red
      
      await client.query(
        `INSERT INTO main.uczestnicy_meczow (uczestnik_id, mecz_id, postac_id, czy_czerwoni) 
         VALUES ($1, $2, $3, $4)`,
        [participantId, matchId, participant.championId, !isRed]
      );
      
      const items = [
        participant.item0, participant.item1, participant.item2,
        participant.item3, participant.item4, participant.item5, participant.item6
      ].filter(itemId => itemId > 0);
      
      for (const itemId of items) {
        await client.query(
          'INSERT INTO main.przedmioty (przedmiot_id, nazwa_przedmiotu) VALUES ($1, $1) ON CONFLICT DO NOTHING',
          [itemId]
        );
        
        await client.query(
          'INSERT INTO main.uczestnicy_przedmioty (uczestnik_id, przedmiot_id) VALUES ($1, $2)',
          [participantId, itemId]
        );
      }
      
      participantId++;
    }
    
    await client.query('COMMIT');
    
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

router.post('/generate-matches', async (req, res) => {
  try {
    const { count = 50 } = req.body;
    
    console.log(`Generowanie ${count} losowych meczy...`);
    
    const client = await pool.connect();
    
    try {
      const championsResult = await client.query('SELECT postac_id FROM main.postaci');
      const champions = championsResult.rows.map(r => r.postac_id);
      
      if (champions.length < 10) {
        return res.status(400).json({ error: 'Za mało championów w bazie (minimum 10)' });
      }
      
      const itemsResult = await client.query('SELECT przedmiot_id FROM main.przedmioty ORDER BY przedmiot_id');
      const availableItems = itemsResult.rows.map(r => r.przedmiot_id);
      
      if (availableItems.length === 0) {
        return res.status(400).json({ error: 'Brak przedmiotów w bazie danych' });
      }
      
      const patches = ['15.1', '15.2', '15.3', '15.4', '15.5', '15.6', '15.7', '15.8', '15.9', '15.10', '15.11', '15.12', '15.13', '15.14', '15.15', '15.16', '15.17', '15.18', '15.19', '15.20', '15.21', '15.22', '15.23', '15.24', '16.1'];
      
      const lastMatchResult = await client.query('SELECT COALESCE(MAX(mecz_id), 0) as last_id FROM main.mecze');
      const lastParticipantResult = await client.query('SELECT COALESCE(MAX(uczestnik_id), 0) as last_id FROM main.uczestnicy_meczow');
      
      let matchId = lastMatchResult.rows[0].last_id + 1;
      let participantId = lastParticipantResult.rows[0].last_id + 1;
      
      for (let i = 0; i < count; i++) {
        await client.query('BEGIN');
        
        try {
          const patch = patches[Math.floor(Math.random() * patches.length)];
          const start = new Date(2024, 0, 1);
          const end = new Date(2025, 0, 15);
          const date = new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
          const minutes = 20 + Math.floor(Math.random() * 25);
          const seconds = Math.floor(Math.random() * 60);
          const time = `${minutes}:${seconds.toString().padStart(2, '0')}`;
          const redWins = Math.random() > 0.5;
          
          await client.query(
            `INSERT INTO main.mecze (mecz_id, data, wersja, czas_gry, wygrana_czerwonych, api_id) 
             VALUES ($1, $2, $3, $4, $5, $6)`,
            [matchId, date, patch, time, redWins, `RANDOM_${Date.now()}_${i}`]
          );
          
          const shuffled = [...champions].sort(() => Math.random() - 0.5);
          const selectedChampions = shuffled.slice(0, 10);
          
          for (let j = 0; j < 10; j++) {
            const isRed = j < 5;
            await client.query(
              `INSERT INTO main.uczestnicy_meczow (uczestnik_id, mecz_id, postac_id, czy_czerwoni) 
               VALUES ($1, $2, $3, $4)`,
              [participantId, matchId, selectedChampions[j], isRed]
            );
            
            const itemCount = 4 + Math.floor(Math.random() * 3);
            const shuffledItems = [...availableItems].sort(() => Math.random() - 0.5);
            const selectedItems = shuffledItems.slice(0, itemCount);
            
            for (const itemId of selectedItems) {
              await client.query(
                `INSERT INTO main.uczestnicy_przedmioty (uczestnik_id, przedmiot_id) 
                 VALUES ($1, $2)`,
                [participantId, itemId]
              );
            }
            
            participantId++;
          }
          
          await client.query('COMMIT');
          matchId++;
          
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        }
      }
      
      console.log(`Wygenerowano ${count} meczy`);
      res.json({
        success: true,
        count: count,
        message: `Wygenerowano ${count} losowych meczy`
      });
      
    } finally {
      client.release();
    }
    
  } catch (error) {
    console.error('Generate matches error:', error);
    res.status(500).json({ 
      error: 'Failed to generate matches',
      message: error.message 
    });
  }
});

router.post('/raw/przedmiot', async (req, res) => {
  try {
    const { przedmiot_id, nazwa_przedmiotu } = req.body;
    if (!przedmiot_id || !nazwa_przedmiotu) {
      return res.status(400).json({ error: 'przedmiot_id i nazwa_przedmiotu są wymagane' });
    }
    await pool.query(
      `INSERT INTO main.przedmioty (przedmiot_id, nazwa_przedmiotu) VALUES ($1, $2)
       ON CONFLICT (przedmiot_id) DO UPDATE SET nazwa_przedmiotu = EXCLUDED.nazwa_przedmiotu`,
      [przedmiot_id, nazwa_przedmiotu]
    );
    res.json({ message: 'Zapisano przedmiot' });
  } catch (error) {
    console.error('Raw przedmiot error:', error);
    res.status(500).json({ error: 'Nie udało się zapisać przedmiotu' });
  }
});

router.post('/raw/uzytkownik', async (req, res) => {
  try {
    const { nazwa, haslo, czy_admin } = req.body;
    if (!nazwa || !haslo) {
      return res.status(400).json({ error: 'nazwa i haslo są wymagane' });
    }
    await pool.query(
      `INSERT INTO main.użytkownicy (nazwa, hasło, czy_admin) VALUES ($1, $2, $3)
       ON CONFLICT (nazwa) DO UPDATE SET hasło = EXCLUDED.hasło, czy_admin = EXCLUDED.czy_admin`,
      [nazwa, haslo, !!czy_admin]
    );
    res.json({ message: 'Zapisano użytkownika' });
  } catch (error) {
    console.error('Raw użytkownik error:', error);
    res.status(500).json({ error: 'Nie udało się zapisać użytkownika' });
  }
});

router.post('/raw/mecz', async (req, res) => {
  try {
    const { mecz_id, data, wersja, czas_gry, wygrana_czerwonych, api_id } = req.body;
    if (!mecz_id) return res.status(400).json({ error: 'mecz_id jest wymagane' });
    await pool.query(
      `INSERT INTO main.mecze (mecz_id, data, wersja, czas_gry, wygrana_czerwonych, api_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (mecz_id) DO UPDATE SET data = EXCLUDED.data, wersja = EXCLUDED.wersja,
         czas_gry = EXCLUDED.czas_gry, wygrana_czerwonych = EXCLUDED.wygrana_czerwonych, api_id = EXCLUDED.api_id`,
      [mecz_id, data || null, wersja || null, czas_gry || null, wygrana_czerwonych ?? null, api_id || null]
    );
    res.json({ message: 'Zapisano mecz' });
  } catch (error) {
    console.error('Raw mecz error:', error);
    res.status(500).json({ error: 'Nie udało się zapisać meczu' });
  }
});

router.post('/raw/uczestnik', async (req, res) => {
  try {
    const { uczestnik_id, mecz_id, postac_id, czy_czerwoni } = req.body;
    if (!uczestnik_id || !mecz_id || !postac_id) {
      return res.status(400).json({ error: 'uczestnik_id, mecz_id i postac_id są wymagane' });
    }

    const mecz = await pool.query('SELECT 1 FROM main.mecze WHERE mecz_id = $1', [mecz_id]);
    if (mecz.rows.length === 0) return res.status(400).json({ error: 'mecz_id nie istnieje' });
    const postac = await pool.query('SELECT 1 FROM main.postaci WHERE postac_id = $1', [postac_id]);
    if (postac.rows.length === 0) return res.status(400).json({ error: 'postac_id nie istnieje' });

    await pool.query(
      `INSERT INTO main.uczestnicy_meczow (uczestnik_id, mecz_id, postac_id, czy_czerwoni)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (uczestnik_id) DO UPDATE SET mecz_id = EXCLUDED.mecz_id, postac_id = EXCLUDED.postac_id,
         czy_czerwoni = EXCLUDED.czy_czerwoni`,
      [uczestnik_id, mecz_id, postac_id, czy_czerwoni ?? null]
    );
    res.json({ message: 'Zapisano uczestnika meczu' });
  } catch (error) {
    console.error('Raw uczestnik error:', error);
    res.status(500).json({ error: 'Nie udało się zapisać uczestnika meczu' });
  }
});

router.post('/raw/uczestnik-przedmiot', async (req, res) => {
  try {
    const { uczestnik_id, przedmiot_id } = req.body;
    if (!uczestnik_id || !przedmiot_id) {
      return res.status(400).json({ error: 'uczestnik_id i przedmiot_id są wymagane' });
    }

    const uczestnik = await pool.query('SELECT 1 FROM main.uczestnicy_meczow WHERE uczestnik_id = $1', [uczestnik_id]);
    if (uczestnik.rows.length === 0) return res.status(400).json({ error: 'uczestnik_id nie istnieje' });
    const przedmiot = await pool.query('SELECT 1 FROM main.przedmioty WHERE przedmiot_id = $1', [przedmiot_id]);
    if (przedmiot.rows.length === 0) return res.status(400).json({ error: 'przedmiot_id nie istnieje' });

    await pool.query(
      `INSERT INTO main.uczestnicy_przedmioty (uczestnik_id, przedmiot_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [uczestnik_id, przedmiot_id]
    );
    res.json({ message: 'Zapisano przedmiot uczestnika' });
  } catch (error) {
    console.error('Raw uczestnik-przedmiot error:', error);
    res.status(500).json({ error: 'Nie udało się zapisać przedmiotu uczestnika' });
  }
});

router.post('/raw/ulubiona-postac', async (req, res) => {
  try {
    const { użytkownik_nazwa, postac_id } = req.body;
    if (!użytkownik_nazwa || !postac_id) {
      return res.status(400).json({ error: 'użytkownik_nazwa i postac_id są wymagane' });
    }

    const user = await pool.query('SELECT 1 FROM main.użytkownicy WHERE nazwa = $1', [użytkownik_nazwa]);
    if (user.rows.length === 0) return res.status(400).json({ error: 'użytkownik nie istnieje' });
    const postac = await pool.query('SELECT 1 FROM main.postaci WHERE postac_id = $1', [postac_id]);
    if (postac.rows.length === 0) return res.status(400).json({ error: 'postac_id nie istnieje' });

    await pool.query(
      `INSERT INTO main.ulubione_postacie (użytkownik_nazwa, postac_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [użytkownik_nazwa, postac_id]
    );
    res.json({ message: 'Zapisano ulubioną postać' });
  } catch (error) {
    console.error('Raw ulubiona error:', error);
    res.status(500).json({ error: 'Nie udało się zapisać ulubionej postaci' });
  }
});

router.get('/reports/winrate', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM main.v_winrate_postaci ORDER BY winrate DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Report winrate error:', error);
    res.status(500).json({ error: 'Nie udało się pobrać raportu winrate' });
  }
});

router.get('/reports/top-items', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM main.v_top_przedmioty ORDER BY winrate DESC, gry DESC');
    res.json(result.rows);
  } catch (error) {
    console.error('Report top-items error:', error);
    res.status(500).json({ error: 'Nie udało się pobrać raportu przedmiotów' });
  }
});

router.get('/reports/patches', async (_req, res) => {
  try {
    const result = await pool.query('SELECT * FROM main.v_patch_statystyka');
    res.json(result.rows);
  } catch (error) {
    console.error('Report patches error:', error);
    res.status(500).json({ error: 'Nie udało się pobrać raportu patchy' });
  }
});

module.exports = router;
