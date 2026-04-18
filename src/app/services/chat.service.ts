import { Injectable, signal } from '@angular/core';
import {
  initialize,
  type DropOnAirClient,
  type DecryptedMessage,
  type DropOnAirEvent,
  type GroupInfo,
  type DecryptedGroupMessage,
} from '@droponair/sdk-js';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ChatMessage {
  id: string;
  fromUserId: string;
  text: string;
  timestamp: number;
  isSelf: boolean;
  groupId?: string;
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly messages = signal<ChatMessage[]>([]);
  readonly isConnected = signal(false);

  // Call state
  readonly activeCallId = signal<string | null>(null);
  readonly callStatus = signal<string>('');
  readonly incomingCall = signal<{ callId: string; from: string } | null>(null);

  // Group state
  readonly groups = signal<GroupInfo[]>([]);
  readonly activeGroupId = signal<string | null>(null);
  readonly groupMessages = signal<ChatMessage[]>([]);

  private client: DropOnAirClient | null = null;

  constructor(private auth: AuthService) {}

  async connect(): Promise<void> {
    if (this.client) return;

    this.client = await initialize({
      appId:         environment.droponairAppId,
      publicApiKey:  environment.droponairPublicApiKey,
      getUserJwt:    () => this.auth.getJwt(),
      tokenExchangeEndpoint: `${environment.backendUrl}/api/droponair/token`,
      keyDirectoryEndpoint:  `${environment.backendUrl}/api/droponair/keys`,
    });

    // Register event listener for connection state and errors
    this.client.onEvent((event: DropOnAirEvent) => {
      switch (event.type) {
        case 'CONNECTED':
          console.log('[DropOnAir] connected');
          this.isConnected.set(true);
          break;
        case 'DISCONNECTED':
          console.warn('[DropOnAir] disconnected');
          this.isConnected.set(false);
          break;
        case 'ERROR':
          console.error('[DropOnAir] error', event);
          break;
      }
    });

    // Register message listener
    this.client.onMessage((msg: DecryptedMessage) => {
      this.messages.update(prev => [...prev, {
        id:         msg.messageId,
        fromUserId: msg.fromUserId,
        text:       msg.plaintext,
        timestamp:  msg.timestamp,
        isSelf:     false,
      }]);
    });

    // Register call event listener
    this.client.onCallEvent((event) => {
      switch (event.type) {
        case 'CALL_INVITE':
          this.activeCallId.set(event.callId ?? null);
          this.incomingCall.set({ callId: event.callId ?? '', from: event.targetUserId ?? '' });
          this.callStatus.set('Incoming call…');
          break;
        case 'CALL_ACCEPTED':
          this.callStatus.set('Call active');
          this.incomingCall.set(null);
          break;
        case 'CALL_RINGING':
          this.callStatus.set('Ringing…');
          break;
        case 'CALL_ENDED':
        case 'CALL_REJECTED':
        case 'CALL_CANCELLED':
          this.activeCallId.set(null);
          this.callStatus.set('');
          this.incomingCall.set(null);
          break;
        case 'CALL_DENIED_LIMIT_REACHED':
          this.activeCallId.set(null);
          this.callStatus.set('Call limit reached');
          this.incomingCall.set(null);
          break;
      }
    });

    // Register group message listener
    this.client.onGroupMessage((msg: DecryptedGroupMessage) => {
      this.groupMessages.update(prev => [...prev, {
        id:         msg.messageId,
        fromUserId: msg.fromUserId,
        text:       msg.plaintext ?? '',
        timestamp:  msg.timestamp,
        isSelf:     false,
        groupId:    msg.groupId,
      }]);
    });
  }

  async sendMessage(toUserId: string, text: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const myId = this.auth.userId()!;
    const { messageId: clientMsgId } = await this.client.sendMessage(toUserId, text);

    // Optimistically add to local messages
    this.messages.update(prev => [...prev, {
      id:         clientMsgId,
      fromUserId: myId,
      text,
      timestamp:  Date.now(),
      isSelf:     true,
    }]);
  }

  disconnect(): void {
    this.client?.disconnect();
    this.client = null;
    this.isConnected.set(false);
    this.messages.set([]);
    this.activeCallId.set(null);
    this.callStatus.set('');
    this.incomingCall.set(null);
    this.groups.set([]);
    this.activeGroupId.set(null);
    this.groupMessages.set([]);
  }

  async startCall(toUserId: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const callId = await this.client.startCall(toUserId);
    this.activeCallId.set(callId);
    this.callStatus.set(`Calling ${toUserId}…`);
  }

  async acceptCall(callId: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.acceptCall(callId);
    this.incomingCall.set(null);
    this.callStatus.set('Call active');
  }

  async rejectCall(callId: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.rejectCall(callId);
    this.activeCallId.set(null);
    this.incomingCall.set(null);
    this.callStatus.set('');
  }

  async endCall(): Promise<void> {
    const callId = this.activeCallId();
    if (!this.client || !callId) return;
    await this.client.endCall(callId);
    this.activeCallId.set(null);
    this.callStatus.set('');
  }

  // ── Group methods ─────────────────────────────────────────────────────────

  async createGroup(name: string, memberUserIds: string[]): Promise<GroupInfo> {
    if (!this.client) throw new Error('Not connected');
    const group = await this.client.createGroup(name, memberUserIds);
    this.groups.update(prev => [...prev, group]);
    return group;
  }

  async loadGroups(): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const groups = await this.client.listGroups();
    this.groups.set(groups);
  }

  async sendGroupMessage(groupId: string, text: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const myId = this.auth.userId()!;
    await this.client.sendGroupMessage(groupId, text);
    this.groupMessages.update(prev => [...prev, {
      id:         crypto.randomUUID(),
      fromUserId: myId,
      text,
      timestamp:  Date.now(),
      isSelf:     true,
      groupId,
    }]);
  }

  selectGroup(groupId: string | null): void {
    this.activeGroupId.set(groupId);
    this.groupMessages.set([]);
  }
}
