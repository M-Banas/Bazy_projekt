const express = require('express');
const router = express.Router();
const pool = require('../config/database');


router.get('/profile', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT nazwa, czy_admin FROM main.użytkownicy WHERE nazwa = $1',
      [req.user.username]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});


router.get('/favorites', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT up.postac_id, p.nazwa
      FROM main.ulubione_postacie up
      JOIN main.postaci p ON up.postac_id = p.postac_id
      WHERE up.użytkownik_nazwa = $1
      ORDER BY p.nazwa
    `, [req.user.username]);

    res.json(result.rows);
  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({ error: 'Failed to fetch favorite champions' });
  }
});


router.post('/favorites', async (req, res) => {
  try {
    const { postac_id } = req.body;

    const alreadyFavorite = await pool.query(
      'SELECT * FROM main.ulubione_postacie WHERE użytkownik_nazwa = $1 AND postac_id = $2',
      [req.user.username, postac_id]
    );

    if (alreadyFavorite.rows.length > 0) {
      return res.status(400).json({ error: 'Champion already in favorites' });
    }

    await pool.query(
      'INSERT INTO main.ulubione_postacie (użytkownik_nazwa, postac_id) VALUES ($1, $2)',
      [req.user.username, postac_id]
    );

    res.status(201).json({ message: 'Champion added to favorites' });
  } catch (error) {
    console.error('Add favorite error:', error);
    res.status(500).json({ error: 'Failed to add favorite champion' });
  }
});

router.delete('/favorites/:postac_id', async (req, res) => {
  try {
    const { postac_id } = req.params;

    const result = await pool.query(
      'DELETE FROM main.ulubione_postacie WHERE użytkownik_nazwa = $1 AND postac_id = $2 RETURNING *',
      [req.user.username, postac_id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ message: 'Champion removed from favorites' });
  } catch (error) {
    console.error('Remove favorite error:', error);
    res.status(500).json({ error: 'Failed to remove favorite champion' });
  }
});

module.exports = router;
