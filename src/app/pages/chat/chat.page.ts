import { Component, computed, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { DatePipe, DecimalPipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonFooter,
  IonItem, IonLabel, IonInput, IonButton, IonIcon, IonBadge,
  IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonList,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sendOutline, callOutline, closeCircleOutline, addOutline, peopleOutline, createOutline, trashOutline, attachOutline, desktopOutline } from 'ionicons/icons';
import { ActionSheetController, AlertController } from '@ionic/angular/standalone';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    FormsModule, DatePipe, DecimalPipe,
    IonContent, IonHeader, IonTitle, IonToolbar, IonFooter,
    IonItem, IonLabel, IonInput, IonButton, IonIcon, IonBadge,
    IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonList,
  ],
  template: `
    <ion-header>
      <ion-toolbar color="primary">
        <ion-buttons slot="start">
          <ion-back-button defaultHref="/login" />
        </ion-buttons>
        <ion-title>Chat ({{ myId() }})</ion-title>
        <ion-badge slot="end" [color]="chat.isConnected() ? 'success' : 'danger'" style="margin-right:12px">
          {{ chat.isConnected() ? 'Online' : 'Offline' }}
        </ion-badge>
        @if (chat.callStatus()) {
          <ion-badge slot="end" color="warning" style="margin-right:8px">
            {{ chat.callStatus() }}
          </ion-badge>
        }
      </ion-toolbar>
      <ion-toolbar>
        <ion-segment [value]="tab()" (ionChange)="tab.set($any($event).detail.value)">
          <ion-segment-button value="dm">DM</ion-segment-button>
          <ion-segment-button value="groups">Groups</ion-segment-button>
        </ion-segment>
      </ion-toolbar>
    </ion-header>

    <ion-content #content class="ion-padding">
      @if (chat.incomingCall()) {
        <div style="background:#fff3cd;padding:12px;border-radius:8px;margin-bottom:12px;display:flex;align-items:center;gap:8px">
          <span>📞 Incoming call from <strong>{{ chat.incomingCall()!.from }}</strong></span>
          <ion-button size="small" color="success" (click)="acceptCall()">Accept</ion-button>
          <ion-button size="small" color="danger" (click)="rejectCall()">Reject</ion-button>
        </div>
      }

      @if (chat.peerScreenSharing()) {
        <div style="background:#fef3c7;color:#92400e;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:13px;display:flex;align-items:center;gap:6px">
          🖥️ <span>Peer is sharing their screen.</span>
        </div>
      }
      @if (chat.amScreenSharing()) {
        <div style="background:#dcfce7;color:#166534;padding:8px 12px;border-radius:8px;margin-bottom:8px;font-size:13px;display:flex;align-items:center;gap:6px">
          🖥️ <span>You are sharing your screen.</span>
        </div>
      }

      @if (tab() === 'dm') {
        @for (msg of chat.messages(); track msg.id) {
          <div [style.textAlign]="msg.isSelf ? 'right' : 'left'" style="margin-bottom:8px">
            <div style="display:inline-block;padding:8px 12px;border-radius:12px;max-width:75%;cursor:pointer"
                 [style.backgroundColor]="msg.deleted ? '#ddd' : (msg.isSelf ? '#3880ff' : '#f4f5f8')"
                 [style.color]="msg.deleted ? '#666' : (msg.isSelf ? 'white' : '#222')"
                 [style.fontStyle]="msg.deleted ? 'italic' : 'normal'"
                 (click)="onMessageTap(msg)">
              @if (!msg.isSelf) {
                <div style="font-size:11px;opacity:.6;margin-bottom:2px">{{ msg.fromUserId }}</div>
              }
              <div>{{ msg.text }}</div>
              @if (msg.attachments && msg.attachments.length > 0) {
                <div style="margin-top:6px;display:flex;flex-direction:column;gap:6px">
                  @for (att of msg.attachments; track att.ref.attachmentId) {
                    <div (click)="$event.stopPropagation(); openAttachment(att)"
                         style="display:flex;align-items:center;gap:6px;padding:6px 8px;background:rgba(0,0,0,0.08);border-radius:8px;cursor:pointer;">
                      <span>📎</span>
                      <span style="font-size:11px;">
                        {{ att.ref.mimeType || 'file' }} · {{ (att.ref.sizeBytes / 1024) | number:'1.0-0' }} KB
                      </span>
                    </div>
                    @if (att.objectUrl && (att.ref.mimeType || '').startsWith('image/')) {
                      <img [src]="att.objectUrl" style="max-width:240px;border-radius:8px;display:block" />
                    }
                  }
                </div>
              }
              <div style="font-size:10px;opacity:.6;margin-top:2px">
                {{ msg.timestamp | date:'HH:mm' }}
                @if (msg.edited) { <span> · edited</span> }
              </div>
            </div>
          </div>
        }
      }

      @if (tab() === 'groups') {
        @if (!chat.activeGroupId()) {
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <ion-input [(ngModel)]="newGroupName" placeholder="Group name" style="flex:1" />
            <ion-input [(ngModel)]="newGroupMembers" placeholder="member1,member2" style="flex:1" />
            <ion-button size="small" (click)="createGroup()">
              <ion-icon slot="icon-only" name="add-outline" />
            </ion-button>
          </div>
          <ion-list>
            @for (g of chat.groups(); track g.groupId) {
              <ion-item button (click)="openGroup(g.groupId)">
                <ion-icon name="people-outline" slot="start" />
                <ion-label>
                  <h2>{{ g.name || g.groupId }}</h2>
                  <p>{{ g.members.length }} members</p>
                </ion-label>
              </ion-item>
            }
          </ion-list>
        } @else {
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px">
            <ion-button size="small" fill="outline" (click)="backToGroups()">← Back</ion-button>
            <strong>{{ chat.activeGroupId() }}</strong>
          </div>
          @for (msg of chat.groupMessages(); track msg.id) {
            <div [style.textAlign]="msg.isSelf ? 'right' : 'left'" style="margin-bottom:8px">
              <div style="display:inline-block;padding:8px 12px;border-radius:12px;max-width:75%"
                   [style.backgroundColor]="msg.isSelf ? '#3880ff' : '#e8f5e9'"
                   [style.color]="msg.isSelf ? 'white' : '#222'">
                @if (!msg.isSelf) {
                  <div style="font-size:11px;opacity:.6;margin-bottom:2px">{{ msg.fromUserId }}</div>
                }
                <div>{{ msg.text }}</div>
                <div style="font-size:10px;opacity:.6;margin-top:2px">{{ msg.timestamp | date:'HH:mm' }}</div>
              </div>
            </div>
          }
        }
      }
    </ion-content>

    <ion-footer>
      @if (tab() === 'dm') {
        <ion-item lines="none">
          <ion-input
            [(ngModel)]="toUserId"
            placeholder="Recipient user ID"
            style="max-width:130px;margin-right:8px"
          />
          <ion-input
            [(ngModel)]="messageText"
            placeholder="Type a message…"
            (keyup.enter)="send()"
            style="flex:1"
          />
          <input
            type="file"
            #fileInput
            accept="image/*,video/*"
            (change)="onFilePicked($event)"
            style="display:none"
          />
          <ion-button fill="clear" (click)="fileInput.click()" [disabled]="!toUserId.trim() || uploading">
            <ion-icon slot="icon-only" name="attach-outline" />
          </ion-button>
          <ion-button fill="clear" (click)="send()" [disabled]="!messageText.trim() && pendingAttachments.length === 0">
            <ion-icon slot="icon-only" name="send-outline" />
          </ion-button>
          @if (chat.activeCallId()) {
            <ion-button
              fill="clear"
              [color]="chat.amScreenSharing() ? 'warning' : 'medium'"
              (click)="toggleScreenShare()">
              <ion-icon slot="icon-only" name="desktop-outline" />
            </ion-button>
            <ion-button fill="clear" color="danger" (click)="endCall()">
              <ion-icon slot="icon-only" name="close-circle-outline" />
            </ion-button>
          } @else {
            <ion-button fill="clear" color="success" (click)="startCall()" [disabled]="!toUserId.trim()">
              <ion-icon slot="icon-only" name="call-outline" />
            </ion-button>
          }
        </ion-item>
      }
      @if (tab() === 'groups' && chat.activeGroupId()) {
        <ion-item lines="none">
          <ion-input
            [(ngModel)]="groupMessageText"
            placeholder="Type a group message…"
            (keyup.enter)="sendGroupMsg()"
            style="flex:1"
          />
          <ion-button fill="clear" (click)="sendGroupMsg()" [disabled]="!groupMessageText.trim()">
            <ion-icon slot="icon-only" name="send-outline" />
          </ion-button>
        </ion-item>
      }
    </ion-footer>
  `,
})
export class ChatPage implements AfterViewChecked {
  @ViewChild('content', { read: ElementRef }) contentEl?: ElementRef;

  tab          = signal<'dm' | 'groups'>('dm');
  toUserId     = '';
  messageText  = '';
  pendingAttachments: import('@droponair/sdk-js').AttachmentRef[] = [];
  uploading = false;
  newGroupName    = '';
  newGroupMembers = '';
  groupMessageText = '';
  myId = computed(() => this.auth.userId());

  constructor(
    readonly auth: AuthService,
    readonly chat: ChatService,
    private readonly actionSheetCtrl: ActionSheetController,
    private readonly alertCtrl: AlertController,
  ) {
    addIcons({ sendOutline, callOutline, closeCircleOutline, addOutline, peopleOutline, createOutline, trashOutline, attachOutline, desktopOutline });
  }

  ngAfterViewChecked(): void {
    // Scroll to bottom when new messages arrive
    const el = this.contentEl?.nativeElement as HTMLElement | undefined;
    if (el) el.scrollTop = el.scrollHeight;
  }

  async send(): Promise<void> {
    const text = this.messageText.trim();
    const to   = this.toUserId.trim();
    if (!to) return;
    if (!text && this.pendingAttachments.length === 0) return;
    const attachmentsToSend = this.pendingAttachments;
    this.pendingAttachments = [];
    this.messageText = '';
    try {
      await this.chat.sendMessage(to, text, attachmentsToSend);
    } catch (e) {
      console.error('Send error', e);
    }
  }

  async onFilePicked(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = ''; // allow re-selecting the same file
    if (!file) return;
    const to = this.toUserId.trim();
    if (!to) return;
    this.uploading = true;
    try {
      const ref = await this.chat.prepareAttachment(file, to);
      this.pendingAttachments = [...this.pendingAttachments, ref];
    } catch (e) {
      console.error('Attachment upload error', e);
    } finally {
      this.uploading = false;
    }
  }

  async openAttachment(att: import('../../services/chat.service').ChatAttachment): Promise<void> {
    try {
      const url = await this.chat.openAttachment(att);
      window.open(url, '_blank');
    } catch (e) {
      console.error('Attachment open error', e);
    }
  }

  async startCall(): Promise<void> {
    const to = this.toUserId.trim();
    if (!to) return;
    try {
      await this.chat.startCall(to);
    } catch (e) {
      console.error('Call error', e);
    }
  }

  async acceptCall(): Promise<void> {
    const incoming = this.chat.incomingCall();
    if (!incoming) return;
    try {
      await this.chat.acceptCall(incoming.callId);
    } catch (e) {
      console.error('Accept error', e);
    }
  }

  async rejectCall(): Promise<void> {
    const incoming = this.chat.incomingCall();
    if (!incoming) return;
    try {
      await this.chat.rejectCall(incoming.callId);
    } catch (e) {
      console.error('Reject error', e);
    }
  }

  async endCall(): Promise<void> {
    try {
      await this.chat.endCall();
    } catch (e) {
      console.error('End call error', e);
    }
  }

  async toggleScreenShare(): Promise<void> {
    try {
      if (this.chat.amScreenSharing()) {
        await this.chat.stopScreenShareDemo();
      } else {
        await this.chat.startScreenShareDemo();
      }
    } catch (e) {
      console.error('Screen share error', e);
    }
  }

  // ── Edit / Delete (sender-only on own DM messages) ────────────────────────

  async onMessageTap(msg: { id: string; isSelf: boolean; text: string; deleted?: boolean }): Promise<void> {
    // Only the sender can edit or delete, and a deleted message cannot be edited again.
    if (!msg.isSelf || msg.deleted) return;
    const to = this.toUserId.trim();
    if (!to) return;

    const sheet = await this.actionSheetCtrl.create({
      header: 'Message',
      buttons: [
        { text: 'Edit', icon: 'create-outline', handler: () => { this.promptEdit(msg.id, to, msg.text); return true; } },
        { text: 'Delete for everyone', icon: 'trash-outline', role: 'destructive', handler: () => { this.confirmDelete(msg.id, to, 'FOR_EVERYONE'); return true; } },
        { text: 'Delete for me', icon: 'trash-outline', handler: () => { this.confirmDelete(msg.id, to, 'FOR_ME'); return true; } },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async promptEdit(messageId: string, toUserId: string, currentText: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Edit message',
      inputs: [{ name: 'newText', type: 'text', value: currentText, placeholder: 'New text' }],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Save',
          handler: async (data) => {
            const next = (data?.newText ?? '').trim();
            if (!next || next === currentText) return true;
            try {
              await this.chat.editMessage(messageId, toUserId, next);
            } catch (e) {
              console.error('Edit error', e);
            }
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  private async confirmDelete(messageId: string, toUserId: string, scope: 'FOR_EVERYONE' | 'FOR_ME'): Promise<void> {
    try {
      await this.chat.deleteMessage(messageId, toUserId, scope);
    } catch (e) {
      console.error('Delete error', e);
    }
  }

  // ── Group methods ─────────────────────────────────────────────────────────

  async createGroup(): Promise<void> {
    const name = this.newGroupName.trim();
    const members = this.newGroupMembers.split(',').map(s => s.trim()).filter(Boolean);
    if (!name) return;
    try {
      await this.chat.createGroup(name, members);
      this.newGroupName = '';
      this.newGroupMembers = '';
    } catch (e) {
      console.error('Create group error', e);
    }
  }

  openGroup(groupId: string): void {
    this.chat.selectGroup(groupId);
  }

  backToGroups(): void {
    this.chat.selectGroup(null);
  }

  async sendGroupMsg(): Promise<void> {
    const text = this.groupMessageText.trim();
    const groupId = this.chat.activeGroupId();
    if (!text || !groupId) return;
    this.groupMessageText = '';
    try {
      await this.chat.sendGroupMessage(groupId, text);
    } catch (e) {
      console.error('Send group message error', e);
    }
  }
}
