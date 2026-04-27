import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

@WebSocketGateway({
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  },
  namespace: '/ws',
})
export class AppGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(AppGateway.name);

  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket): void {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  @OnEvent('campaign.progress')
  handleCampaignProgress(payload: {
    campaignId: string;
    sentCount: number;
    deliveredCount: number;
    failedCount: number;
    totalContacts: number;
    status: string;
  }): void {
    this.server.emit('campaign:progress', payload);
  }

  @OnEvent('campaign.completed')
  handleCampaignCompleted(payload: { campaignId: string }): void {
    this.server.emit('campaign:completed', payload);
  }

  @OnEvent('session.status')
  handleSessionStatus(payload: {
    sessionId: string;
    status: string;
    qrCode?: string;
  }): void {
    this.server.emit('session:status', payload);
  }

  @OnEvent('contact.import.progress')
  handleContactImportProgress(payload: {
    progress: number;
    total: number;
  }): void {
    this.server.emit('contact:import', payload);
  }
}
