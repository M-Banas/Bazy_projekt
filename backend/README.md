# Backend Node.js z PostgreSQL

## Instalacja

1. Zainstaluj zależności:
   ```bash
   cd backend
   npm install
   ```

2. Skonfiguruj PostgreSQL:
   - Zainstaluj PostgreSQL
   - Utwórz bazę danych (np. `angular_test_db` lub zgodnie z `.env`)
   - Uruchom skrypt inicjalizacyjny:
     ```bash
     psql -U <db_user> -d <db_name> -f database/init.sql
     ```
   - (Opcjonalnie) Użyj `init2.sql`, jeśli chcesz mieć triggery i dodatkowe funkcje.

3. Skonfiguruj zmienne środowiskowe:
   - Skopiuj plik `.env.example` do `.env` i uzupełnij danymi dostępowymi do bazy oraz kluczami API.

## Uruchomienie

```bash
npm start
```

Serwer domyślnie działa na porcie określonym w `.env` (np. `http://localhost:5201`).

## Endpointy API

### Champions
- `GET /api/champions` - Pobierz wszystkich championów
- `GET /api/champions/:id` - Pobierz championa po ID
- `POST /api/champions` - Utwórz nowego championa
- `PUT /api/champions/:id` - Aktualizuj championa
- `DELETE /api/champions/:id` - Usuń championa

### Users
- `GET /api/users` - Pobierz listę użytkowników
- `POST /api/users` - Utwórz nowego użytkownika

### Statystyki i inne zasoby
- `GET /api/stats/winrate` - Statystyki winrate championów
- `GET /api/stats/top-items` - Najczęściej używane przedmioty
- `GET /api/stats/patch-history` - Historia winrate po patchach

## Dodatkowe informacje

- Plik `.env.example` zawiera przykładową konfigurację środowiska.
- Klucz Riot API możesz uzyskać na https://developer.riotgames.com/
- Struktura bazy danych i widoki opisane są w plikach `database/init.sql`.
