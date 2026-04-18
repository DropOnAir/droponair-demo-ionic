import { Injectable, signal } from '@angular/core';
import { environment } from '../../environments/environment';

interface LoginResponse {
  jwt: string;
  userId: string;
  displayName: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  readonly userId   = signal<string | null>(null);
  readonly userName = signal<string | null>(null);
  private jwt: string | null = null;

  async login(userId: string, displayName?: string): Promise<void> {
    const res = await fetch(`${environment.backendUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, displayName: displayName ?? userId }),
    });

    if (!res.ok) throw new Error(`Login failed: HTTP ${res.status}`);

    const data: LoginResponse = await res.json();
    this.jwt = data.jwt;
    this.userId.set(data.userId);
    this.userName.set(data.displayName);
  }

  /** Return the stored JWT (used as getUserJwt callback in DropOnAirConfig). */
  async getJwt(): Promise<string> {
    if (!this.jwt) throw new Error('Not authenticated');
    return this.jwt;
  }

  logout(): void {
    this.jwt = null;
    this.userId.set(null);
    this.userName.set(null);
  }

  get isLoggedIn(): boolean { return this.jwt !== null; }
}
