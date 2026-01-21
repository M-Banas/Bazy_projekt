const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const axios = require('axios');

const DDRAGON_BASE_URL = 'https://ddragon.leagueoflegends.com';
const API_VERSIONS_URL = `${DDRAGON_BASE_URL}/api/versions.json`;
const CHAMPION_DATA_PATH = '/data/en_US/champion.json';

router.post('/sync', async (req, res) => {
  try {
    const versionsResponse = await axios.get(API_VERSIONS_URL);
    const latestVersion = versionsResponse.data[0];
    
    const championsUrl = `${DDRAGON_BASE_URL}/cdn/${latestVersion}${CHAMPION_DATA_PATH}`;
    const championsResponse = await axios.get(championsUrl);
    const championsData = championsResponse.data.data;
    
    let inserted = 0;
    let skipped = 0;
    
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
          inserted++;
        } else {
          skipped++;
        }
      } catch (err) {
        console.error(`Błąd dodawania ${champion.name}:`, err.message);
      }
    }
    
    res.json({
      message: 'Synchronizacja zakończona',
      inserted,
      skipped,
      total: Object.keys(championsData).length
    });
  } catch (error) {
    console.error('Sync error:', error);
    res.status(500).json({ error: 'Failed to sync champions' });
  }
});


router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT postac_id, nazwa 
      FROM main.postaci 
      ORDER BY nazwa
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Get champions error:', error);
    res.status(500).json({ error: 'Failed to fetch champions' });
  }
});

router.post('/', async (req, res) => {
  try {
    const { nazwa, postac_id } = req.body;
    if (!nazwa) {
      return res.status(400).json({ error: 'Nazwa jest wymagana' });
    }

    let result;
    if (postac_id === undefined || postac_id === null || postac_id === '') {
      // Nie przekazuj postac_id, pozwól triggerowi ustawić wartość
      result = await pool.query(
        'INSERT INTO main.postaci (nazwa) VALUES ($1) RETURNING *',
        [nazwa]
      );
    } else {
      result = await pool.query(
        'INSERT INTO main.postaci (nazwa, postac_id) VALUES ($1, $2) RETURNING *',
        [nazwa, postac_id]
      );
    }
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Create champion error:', error);
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Postać o tym ID już istnieje' });
    }
    res.status(500).json({ error: 'Failed to create champion' });
  }
});

router.get('/:id/winrate', async (req, res) => {
  try {
    const { id } = req.params;
    const { patch } = req.query;
    
    let baseQuery = `
      FROM main.postaci p
      LEFT JOIN main.uczestnicy_meczow um ON p.postac_id = um.postac_id
      LEFT JOIN main.mecze m ON um.mecz_id = m.mecz_id
      WHERE p.postac_id = $1`;
    
    const params = [id];
    
    if (patch) {
      baseQuery += ` AND m.wersja = $2`;
      params.push(patch);
    }
    
    const overallResult = await pool.query(`
      SELECT 
        p.postac_id,
        p.nazwa,
        COUNT(um.mecz_id) as total_games,
        SUM(CASE 
          WHEN (um.czy_czerwoni = m.wygrana_czerwonych) THEN 1 
          ELSE 0 
        END) as wins,
        ROUND(
          100.0 * SUM(CASE 
            WHEN (um.czy_czerwoni = m.wygrana_czerwonych) THEN 1 
            ELSE 0 
          END) / NULLIF(COUNT(um.mecz_id), 0), 
          2
        ) as winrate
      ${baseQuery}
      GROUP BY p.postac_id, p.nazwa
    `, params);

    if (overallResult.rows.length === 0) {
      return res.status(404).json({ error: 'Champion not found' });
    }

    const redResult = await pool.query(`
      SELECT 
        COUNT(um.mecz_id) as total_games,
        SUM(CASE WHEN m.wygrana_czerwonych = true THEN 1 ELSE 0 END) as wins,
        ROUND(
          100.0 * SUM(CASE WHEN m.wygrana_czerwonych = true THEN 1 ELSE 0 END) / NULLIF(COUNT(um.mecz_id), 0), 
          2
        ) as winrate
      ${baseQuery} AND um.czy_czerwoni = true
    `, params);

    const blueResult = await pool.query(`
      SELECT 
        COUNT(um.mecz_id) as total_games,
        SUM(CASE WHEN m.wygrana_czerwonych = false THEN 1 ELSE 0 END) as wins,
        ROUND(
          100.0 * SUM(CASE WHEN m.wygrana_czerwonych = false THEN 1 ELSE 0 END) / NULLIF(COUNT(um.mecz_id), 0), 
          2
        ) as winrate
      ${baseQuery} AND um.czy_czerwoni = false
    `, params);

    const data = overallResult.rows[0];
    const redData = redResult.rows[0];
    const blueData = blueResult.rows[0];

    res.json({
      postac_id: data.postac_id,
      nazwa: data.nazwa,
      overall: {
        total_games: parseInt(data.total_games),
        wins: parseInt(data.wins),
        winrate: parseFloat(data.winrate) || 0
      },
      red_side: {
        total_games: parseInt(redData.total_games),
        wins: parseInt(redData.wins),
        winrate: parseFloat(redData.winrate) || 0
      },
      blue_side: {
        total_games: parseInt(blueData.total_games),
        wins: parseInt(blueData.wins),
        winrate: parseFloat(blueData.winrate) || 0
      }
    });
  } catch (error) {
    console.error('Get champion winrate error:', error);
    res.status(500).json({ error: 'Failed to fetch champion winrate' });
  }
});

router.get('/:id/winrate-history', async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT 
        m.wersja as patch,
        COUNT(um.mecz_id) as total_games,
        SUM(CASE 
          WHEN (um.czy_czerwoni = m.wygrana_czerwonych) THEN 1 
          ELSE 0 
        END) as wins,
        ROUND(
          100.0 * SUM(CASE 
            WHEN (um.czy_czerwoni = m.wygrana_czerwonych) THEN 1 
            ELSE 0 
          END) / NULLIF(COUNT(um.mecz_id), 0), 
          2
        ) as winrate
      FROM main.postaci p
      LEFT JOIN main.uczestnicy_meczow um ON p.postac_id = um.postac_id
      LEFT JOIN main.mecze m ON um.mecz_id = m.mecz_id
      WHERE p.postac_id = $1 AND m.wersja IS NOT NULL
      GROUP BY m.wersja
      ORDER BY m.wersja
    `, [id]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get champion winrate history error:', error);
    res.status(500).json({ error: 'Failed to fetch champion winrate history' });
  }
});

router.get('/favorites/:username', async (req, res) => {
  try {
    const { username } = req.params;
    
    const result = await pool.query(`
      SELECT p.postac_id, p.nazwa
      FROM main.ulubione_postacie up
      JOIN main.postaci p ON up.postac_id = p.postac_id
      WHERE up.użytkownik_nazwa = $1
      ORDER BY p.nazwa
    `, [username]);
    
    res.json(result.rows);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorite champions' });
  }
});

router.post('/favorites', async (req, res) => {
  try {
    const { username, postac_id } = req.body;
    
    console.log('Add favorite - username:', username, 'postac_id:', postac_id);
    console.log('Add favorite - req.user:', req.user);
    
    if (!username || !postac_id) {
      return res.status(400).json({ error: 'Username i postac_id są wymagane' });
    }
    
    await pool.query(
      'INSERT INTO main.ulubione_postacie (użytkownik_nazwa, postac_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [username, postac_id]
    );
    
    console.log('Successfully added to favorites');
    res.status(201).json({ message: 'Dodano do ulubionych', username, postac_id });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite champion' });
  }
});

router.delete('/favorites/:username/:postac_id', async (req, res) => {
  try {
    const { username, postac_id } = req.params;
    
    const result = await pool.query(
      'DELETE FROM main.ulubione_postacie WHERE użytkownik_nazwa = $1 AND postac_id = $2 RETURNING *',
      [username, postac_id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Ulubiona postać nie znaleziona' });
    }
    
    res.json({ message: 'Usunięto z ulubionych', username, postac_id });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite champion' });
  }
});

router.get('/patches', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT wersja 
      FROM main.mecze 
      WHERE wersja IS NOT NULL
      ORDER BY wersja DESC
    `);
    
    res.json(result.rows.map(r => r.wersja));
  } catch (error) {
    console.error('Get patches error:', error);
    res.status(500).json({ error: 'Failed to fetch patches' });
  }
});

router.get('/:id/top-items', async (req, res) => {
  try {
    const { id } = req.params;
    const { patch } = req.query;
    
    let query = `
      WITH item_stats AS (
        SELECT 
          up.przedmiot_id,
          pr.nazwa_przedmiotu,
          COUNT(*) as games_count,
          SUM(CASE 
            WHEN (um.czy_czerwoni = true AND m.wygrana_czerwonych = true) OR
                 (um.czy_czerwoni = false AND m.wygrana_czerwonych = false)
            THEN 1 
            ELSE 0 
          END) as wins
        FROM main.uczestnicy_przedmioty up
        JOIN main.uczestnicy_meczow um ON up.uczestnik_id = um.uczestnik_id
        JOIN main.mecze m ON um.mecz_id = m.mecz_id
        JOIN main.przedmioty pr ON up.przedmiot_id = pr.przedmiot_id
        WHERE um.postac_id = $1`;
    
    const params = [id];
    
    if (patch) {
      query += ` AND m.wersja = $2`;
      params.push(patch);
    }
    
    query += `
        GROUP BY up.przedmiot_id, pr.nazwa_przedmiotu
        HAVING COUNT(*) >= 2
      )
      SELECT 
        przedmiot_id,
        nazwa_przedmiotu,
        games_count,
        wins,
        ROUND((wins::decimal / games_count * 100), 2) as winrate
      FROM item_stats
      ORDER BY winrate DESC, games_count DESC`;
    
    const result = await pool.query(query, params);
    
    console.log(`Top items for champion ${id}${patch ? ` (patch ${patch})` : ''}:`, result.rows.length, 'items');
    res.json(result.rows);
  } catch (error) {
    console.error('Get champion top items error:', error);
    res.status(500).json({ error: 'Failed to fetch champion top items' });
  }
});

module.exports = router;
