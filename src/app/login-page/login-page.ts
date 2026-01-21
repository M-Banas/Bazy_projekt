import { Component, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login-page',
  imports: [FormsModule, RouterModule],
  templateUrl: './login-page.html',
  styleUrl: './login-page.css',
})
export class LoginPage {
  username = signal('');
  password = signal('');
  errorMessage = signal('');

  constructor(
    private authService: AuthService,
    private router: Router
  ) {}

  async onSubmit(event: Event): Promise<void> {
    event.preventDefault();
    
    const success = await this.authService.login(this.username(), this.password());
    
    if (success) {
      this.router.navigate(['/panel']);
    } else {
      this.errorMessage.set('Nieprawidłowy login lub hasło');
      setTimeout(() => this.errorMessage.set(''), 3000);
    }
  }
}
