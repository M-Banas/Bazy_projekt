# Backend Node.js z PostgreSQL

## Instalacja

1. Zainstaluj zależności:
```bash
cd backend
npm install
```

2. Skonfiguruj PostgreSQL:
   - Zainstaluj PostgreSQL
   - Utwórz bazę danych `angular_test_db`
   - Uruchom skrypt inicjalizacyjny:
```bash
psql -U postgres -f database/init.sql
```

3. Skonfiguruj zmienne środowiskowe:
   - Dostosuj ustawienia bazy danych w pliku `.env`

## Uruchomienie

### Tryb produkcyjny:
```bash
npm start
```

### Tryb deweloperski (z auto-restartem):
```bash
npm run dev
```

Serwer domyślnie działa na porcie 3000: `http://localhost:3000`

## Endpointy API

### Autoryzacja
- `POST /api/auth/register` - Rejestracja nowego użytkownika
- `POST /api/auth/login` - Logowanie użytkownika

### Champions
- `GET /api/champions` - Pobierz wszystkich championów
- `GET /api/champions/:id` - Pobierz championsa po ID
- `POST /api/champions` - Utwórz nowego championsa (wymaga tokena)
- `PUT /api/champions/:id` - Aktualizuj championsa (wymaga tokena)
- `DELETE /api/champions/:id` - Usuń championsa (wymaga tokena)

### Users
- `GET /api/users/profile` - Pobierz profil użytkownika (wymaga tokena)
- `PUT /api/users/profile` - Aktualizuj profil użytkownika (wymaga tokena)

### Health Check
- `GET /api/health` - Sprawdź status serwera

## Autoryzacja

Chronione endpointy wymagają tokena JWT w nagłówku:
```
Authorization: Bearer <your_token>
```

Token otrzymujesz po zalogowaniu.
