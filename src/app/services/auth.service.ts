import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { API_BASE_URL } from '../config/api.config';

export interface User {
  username: string;
  role: 'user' | 'admin';
}

const BACKEND_URL = API_BASE_URL;

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private currentUser = signal<User | null>(null);
  
  isLoggedIn = signal(false);
  user = this.currentUser.asReadonly();

  constructor(private http: HttpClient) {
    // Sprawdź czy użytkownik jest zalogowany (localStorage)
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
      this.currentUser.set(JSON.parse(savedUser));
      this.isLoggedIn.set(true);
    }
  }

  async login(username: string, password: string): Promise<boolean> {
    console.log('Login attempt:', username);
    
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${BACKEND_URL}/auth/login`, { username, password })
      );
      
      if (response.user) {
        const user: User = {
          username: response.user.username,
          role: response.user.isAdmin ? 'admin' : 'user'
        };
        
        this.currentUser.set(user);
        this.isLoggedIn.set(true);
        localStorage.setItem('currentUser', JSON.stringify(user));
        console.log('✅ Login successful!');
        return true;
      }
      
      return false;
    } catch (error: any) {
      console.error('Login failed:', error);
      return false;
    }
  }

  async register(username: string, password: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await firstValueFrom(
        this.http.post<any>(`${BACKEND_URL}/auth/register`, { username, password })
      );
      
      return {
        success: true,
        message: response.message || 'Rejestracja zakończona pomyślnie'
      };
    } catch (error: any) {
      console.error('Registration error:', error);
      return {
        success: false,
        message: error.error?.error || 'Rejestracja nie powiodła się'
      };
    }
  }

  logout(): void {
    this.currentUser.set(null);
    this.isLoggedIn.set(false);
    localStorage.removeItem('currentUser');
  }

  isAdmin(): boolean {
    return this.currentUser()?.role === 'admin';
  }
}
