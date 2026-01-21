// Funkcja zwracająca dynamiczny URL API na podstawie aktualnego hosta
export function getApiBaseUrl(): string {
  // Jeśli jesteśmy w trybie deweloperskim (localhost:4200), używaj localhost:3000
  if (window.location.hostname === 'localhost' && window.location.port === '4200') {
    return 'http://localhost:3000/api';
  }
  
  // W produkcji używaj tego samego hosta co frontend
  return `${window.location.origin}/api`;
}

export const API_BASE_URL = getApiBaseUrl();
