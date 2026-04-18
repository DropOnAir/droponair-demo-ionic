import { Component, computed, signal, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  IonContent, IonHeader, IonTitle, IonToolbar, IonFooter,
  IonItem, IonLabel, IonInput, IonButton, IonIcon, IonBadge,
  IonButtons, IonBackButton, IonSegment, IonSegmentButton, IonList,
} from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { sendOutline, callOutline, closeCircleOutline, addOutline, peopleOutline } from 'ionicons/icons';
import { AuthService } from '../../services/auth.service';
import { ChatService } from '../../services/chat.service';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [
    FormsModule, DatePipe,
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

      @if (tab() === 'dm') {
        @for (msg of chat.messages(); track msg.id) {
          <div [style.textAlign]="msg.isSelf ? 'right' : 'left'" style="margin-bottom:8px">
            <div style="display:inline-block;padding:8px 12px;border-radius:12px;max-width:75%"
                 [style.backgroundColor]="msg.isSelf ? '#3880ff' : '#f4f5f8'"
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
          <ion-button fill="clear" (click)="send()" [disabled]="!messageText.trim()">
            <ion-icon slot="icon-only" name="send-outline" />
          </ion-button>
          @if (chat.activeCallId()) {
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
  newGroupName    = '';
  newGroupMembers = '';
  groupMessageText = '';
  myId = computed(() => this.auth.userId());

  constructor(
    readonly auth: AuthService,
    readonly chat: ChatService,
  ) {
    addIcons({ sendOutline, callOutline, closeCircleOutline, addOutline, peopleOutline });
  }

  ngAfterViewChecked(): void {
    // Scroll to bottom when new messages arrive
    const el = this.contentEl?.nativeElement as HTMLElement | undefined;
    if (el) el.scrollTop = el.scrollHeight;
  }

  async send(): Promise<void> {
    const text = this.messageText.trim();
    const to   = this.toUserId.trim();
    if (!text || !to) return;
    this.messageText = '';
    try {
      await this.chat.sendMessage(to, text);
    } catch (e) {
      console.error('Send error', e);
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
