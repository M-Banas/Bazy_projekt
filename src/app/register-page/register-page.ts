import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  standalone: true,
  selector: 'app-register-page',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './register-page.html',
  styleUrl: './register-page.css',
})
export class RegisterPage {
  username = signal('');
  password = signal('');
  confirmPassword = signal('');
  errorMessage = signal('');
  successMessage = signal('');
  loading = signal(false);

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit() {
    this.errorMessage.set('');
    this.successMessage.set('');

    // Walidacja
    if (!this.username() || !this.password() || !this.confirmPassword()) {
      this.errorMessage.set('Wszystkie pola są wymagane');
      return;
    }

    if (this.username().length < 3) {
      this.errorMessage.set('Nazwa użytkownika musi mieć minimum 3 znaki');
      return;
    }

    if (this.password().length < 6) {
      this.errorMessage.set('Hasło musi mieć minimum 6 znaków');
      return;
    }

    if (this.password() !== this.confirmPassword()) {
      this.errorMessage.set('Hasła nie są identyczne');
      return;
    }

    this.loading.set(true);

    try {
      const result = await this.authService.register(this.username(), this.password());
      
      if (result.success) {
        this.successMessage.set(result.message);
        // Przekieruj do logowania po 2 sekundach
        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 2000);
      } else {
        this.errorMessage.set(result.message);
      }
    } catch (error) {
      this.errorMessage.set('Wystąpił błąd podczas rejestracji');
    } finally {
      this.loading.set(false);
    }
  }
}
