import { Injectable, signal } from '@angular/core';
import {
  initialize,
  type DropOnAirClient,
  type DecryptedMessage,
  type DropOnAirEvent,
  type GroupInfo,
  type DecryptedGroupMessage,
  type MessageEditEvent,
  type MessageDeleteEvent,
  type AttachmentRef,
} from '@droponair/sdk-js';
import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

export interface ChatAttachment {
  ref: AttachmentRef;
  /** Decrypted bytes once the user taps to view. Lazy. */
  objectUrl?: string;
}

export interface ChatMessage {
  id: string;
  fromUserId: string;
  text: string;
  timestamp: number;
  isSelf: boolean;
  groupId?: string;
  edited?: boolean;
  deleted?: boolean;
  attachments?: ChatAttachment[];
}

@Injectable({ providedIn: 'root' })
export class ChatService {
  readonly messages = signal<ChatMessage[]>([]);
  readonly isConnected = signal(false);

  // Call state
  readonly activeCallId = signal<string | null>(null);
  readonly callStatus = signal<string>('');
  readonly incomingCall = signal<{ callId: string; from: string } | null>(null);
  /** True while the local user is screen-sharing. */
  readonly amScreenSharing = signal<boolean>(false);
  /** True while the call peer has signalled they are sharing their screen. */
  readonly peerScreenSharing = signal<boolean>(false);

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
        attachments: (msg.attachments ?? []).map(ref => ({ ref })),
      }]);
    });

    // Register message-edit listener (sender re-encrypts; SDK delivers new plaintext)
    this.client.onMessageEdit((event: MessageEditEvent) => {
      this.messages.update(prev => prev.map(m =>
        m.id === event.originalMessageId
          ? { ...m, text: event.plaintext, edited: true, deleted: false }
          : m,
      ));
    });

    // Register message-delete listener (FOR_EVERYONE on recipient side, FOR_ME on sender's other devices)
    this.client.onMessageDelete((event: MessageDeleteEvent) => {
      this.messages.update(prev => prev.map(m =>
        m.id === event.originalMessageId
          ? { ...m, text: '(message deleted)', deleted: true, edited: false }
          : m,
      ));
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
          this.peerScreenSharing.set(false);
          this.amScreenSharing.set(false);
          break;
        case 'CALL_DENIED_LIMIT_REACHED':
          this.activeCallId.set(null);
          this.callStatus.set('Call limit reached');
          this.incomingCall.set(null);
          break;
        case 'CALL_SCREEN_SHARE_STARTED':
          this.peerScreenSharing.set(true);
          break;
        case 'CALL_SCREEN_SHARE_STOPPED':
          this.peerScreenSharing.set(false);
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

  async sendMessage(toUserId: string, text: string, attachments: AttachmentRef[] = []): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    const myId = this.auth.userId()!;
    const { messageId: clientMsgId } = await this.client.sendMessage(toUserId, text, { attachments });

    // Optimistically add to local messages
    this.messages.update(prev => [...prev, {
      id:         clientMsgId,
      fromUserId: myId,
      text,
      timestamp:  Date.now(),
      isSelf:     true,
      attachments: attachments.map(ref => ({ ref })),
    }]);
  }

  /** Encrypt + upload an image attachment via the SDK, returns the ref to embed in sendMessage. */
  async prepareAttachment(file: File, toUserId: string): Promise<AttachmentRef> {
    if (!this.client) throw new Error('Not connected');
    const bytes = new Uint8Array(await file.arrayBuffer());
    return this.client.prepareAttachmentAndUpload(bytes, {
      toUserId,
      mimeType: file.type || 'application/octet-stream',
      encryptionType: 'E2EE',
    });
  }

  /** Download + decrypt an attachment. Returns a local blob URL the UI can render. */
  async openAttachment(attachment: ChatAttachment): Promise<string> {
    if (!this.client) throw new Error('Not connected');
    if (attachment.objectUrl) return attachment.objectUrl;
    const dl = await this.client.downloadAttachment(attachment.ref);
    const blob = new Blob([dl.bytes], { type: dl.mimeType || 'application/octet-stream' });
    const url = URL.createObjectURL(blob);
    attachment.objectUrl = url;
    return url;
  }

  /** Edit a previously sent direct message. Sender device only. */
  async editMessage(originalMessageId: string, toUserId: string, newText: string): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.editMessage(originalMessageId, toUserId, newText);
    // Optimistic local update on sender device.
    this.messages.update(prev => prev.map(m =>
      m.id === originalMessageId
        ? { ...m, text: newText, edited: true, deleted: false }
        : m,
    ));
  }

  /** Delete a previously sent direct message. Sender device only. */
  async deleteMessage(
    originalMessageId: string,
    toUserId: string,
    scope: 'FOR_EVERYONE' | 'FOR_ME' = 'FOR_EVERYONE',
  ): Promise<void> {
    if (!this.client) throw new Error('Not connected');
    await this.client.deleteMessage(originalMessageId, toUserId, scope);
    // Optimistic local update on sender device.
    this.messages.update(prev => prev.map(m =>
      m.id === originalMessageId
        ? { ...m, text: '(message deleted)', deleted: true, edited: false }
        : m,
    ));
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
    this.peerScreenSharing.set(false);
    this.amScreenSharing.set(false);
  }

  /**
   * Demo screen-share signaling. A real app would also call
   *   peerConnection.addTrack(stream.getVideoTracks()[0], stream)
   * to actually send the screen pixels to the peer over the existing
   * WebRTC connection. This demo only exercises the SDK signaling
   * surface so you can confirm the platform routing.
   */
  async startScreenShareDemo(): Promise<void> {
    const callId = this.activeCallId();
    if (!this.client || !callId) return;
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch {
      // User cancelled the picker.
      return;
    }
    const track = stream.getVideoTracks()[0];
    if (!track) return;
    this.client.startScreenShare(callId);
    this.amScreenSharing.set(true);
    this.callStatus.set('Sharing screen');
    track.onended = () => {
      void this.stopScreenShareDemo();
    };
  }

  async stopScreenShareDemo(): Promise<void> {
    const callId = this.activeCallId();
    if (!this.client || !callId) return;
    this.client.stopScreenShare(callId);
    this.amScreenSharing.set(false);
    this.callStatus.set('Call active');
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
    // Demo uses cleartext group messages (server fans out to all members).
    // For end-to-end encrypted group sends, use client.sendGroupMessage with
    // the explicit member list (Android/iOS-parity API since SDK 0.8.0).
    await this.client.sendCleartextGroupMessage(groupId, text);
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
