# Backend Node.js z PostgreSQL


## Wykonaj najpierw
ng build
w glownym katalogu projektu aby zbudowac aplikacje


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


## Dodatkowe informacje

- Plik `.env.example` zawiera przykładową konfigurację środowiska.
- Klucz Riot API możesz uzyskać na https://developer.riotgames.com/  
- Struktura bazy danych i widoki opisane są w plikach `database/init.sql`.
