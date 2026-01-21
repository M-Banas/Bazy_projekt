const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const pool = require('../config/database');


router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Nazwa użytkownika i hasło są wymagane' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Nazwa użytkownika musi mieć minimum 3 znaki' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Hasło musi mieć minimum 6 znaków' });
    }

    const userExists = await pool.query(
      'SELECT * FROM main.użytkownicy WHERE nazwa = $1',
      [username]
    );

    if (userExists.rows.length != 0) {
      return res.status(400).json({ error: 'Użytkownik o tej nazwie już istnieje' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      'INSERT INTO main.użytkownicy (nazwa, hasło, czy_admin) VALUES ($1, $2, $3) RETURNING nazwa, czy_admin',
      [username, hashedPassword, false]
    );

    res.status(201).json({
      message: 'Rejestracja zakończona pomyślnie',
      user: {
        username: result.rows[0].nazwa,
        isAdmin: result.rows[0].czy_admin
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Rejestracja nie powiodła się' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await pool.query(
      'SELECT * FROM main.użytkownicy WHERE nazwa = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    const user = result.rows[0];

    const validPassword = await bcrypt.compare(password, user.hasło);
    if (!validPassword) {
      return res.status(401).json({ error: 'Nieprawidłowa nazwa użytkownika lub hasło' });
    }

    res.json({
      message: 'Logowanie pomyślne',
      user: {
        username: user.nazwa,
        isAdmin: user.czy_admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Logowanie nie powiodło się' });
  }
});

module.exports = router;
