import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonList,
  IonItem, IonLabel, IonInput, IonButton, IonCard,
  IonCardHeader, IonCardTitle, IonCardContent,
} from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    FormsModule,
    IonContent, IonHeader, IonTitle, IonToolbar,
    IonList, IonItem, IonLabel, IonInput, IonButton,
    IonCard, IonCardHeader, IonCardTitle, IonCardContent,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-title>DropOnAir Demo</ion-title>
      </ion-toolbar>
    </ion-header>

    <ion-content class="ion-padding">
      <ion-card>
        <ion-card-header>
          <ion-card-title>Sign In (Demo)</ion-card-title>
        </ion-card-header>
        <ion-card-content>
          <ion-list>
            <ion-item>
              <ion-label position="stacked">User ID</ion-label>
              <ion-input [(ngModel)]="userId" placeholder="e.g. alice" clearInput />
            </ion-item>
            <ion-item>
              <ion-label position="stacked">Display Name (optional)</ion-label>
              <ion-input [(ngModel)]="displayName" placeholder="e.g. Alice" clearInput />
            </ion-item>
          </ion-list>
          <ion-button expand="block" class="ion-margin-top" (click)="login()" [disabled]="loading">
            {{ loading ? 'Connecting…' : 'Sign In' }}
          </ion-button>
          @if (error) {
            <p style="color: red; margin-top: 8px">{{ error }}</p>
          }
        </ion-card-content>
      </ion-card>
    </ion-content>
  `,
})
export class LoginPage {
  userId      = '';
  displayName = '';
  loading     = false;
  error: string | null = null;

  constructor(
    private auth: AuthService,
    private chat: ChatService,
    private router: Router,
  ) {}

  async login(): Promise<void> {
    if (!this.userId.trim()) { this.error = 'User ID is required'; return; }
    this.loading = true;
    this.error   = null;
    try {
      await this.auth.login(this.userId.trim(), this.displayName.trim() || undefined);
      await this.chat.connect();
      await this.router.navigate(['/chat']);
    } catch (e: any) {
      this.error = e?.message ?? 'Login failed';
    } finally {
      this.loading = false;
    }
  }
}
