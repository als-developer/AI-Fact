/**
 * Notification Service
 * Sends email, webhook, and in-app notifications
 */

import type { Bindings } from '../types';

export interface Notification {
  type: 'email' | 'webhook' | 'in_app';
  recipient: string;
  subject?: string;
  message: string;
  data?: any;
}

export class NotificationService {
  constructor(private env: Bindings) {}

  async send(notification: Notification): Promise<void> {
    switch (notification.type) {
      case 'email':
        await this.sendEmail(notification);
        break;
      case 'webhook':
        await this.sendWebhook(notification);
        break;
      case 'in_app':
        await this.sendInApp(notification);
        break;
    }
  }

  private async sendEmail(notification: Notification): Promise<void> {
    // Queue email for sending
    await this.env.EMAIL_QUEUE.send({
      type: 'email',
      to: notification.recipient,
      subject: notification.subject,
      body: notification.message,
      timestamp: Date.now(),
    });
  }

  private async sendWebhook(notification: Notification): Promise<void> {
    // Queue webhook
    await this.env.WEBHOOK_QUEUE.send({
      type: 'webhook',
      url: notification.recipient,
      payload: {
        message: notification.message,
        data: notification.data,
        timestamp: Date.now(),
      },
    });
  }

  private async sendInApp(notification: Notification): Promise<void> {
    // Store in database for retrieval
    await this.env.DB.prepare(`
      INSERT INTO notifications (id, user_id, message, read, created_at)
      VALUES (?, ?, ?, 0, ?)
    `).bind(crypto.randomUUID(), notification.recipient, notification.message, Date.now()).run();
  }

  async sendVerificationComplete(userId: string, jobId: string, score: number): Promise<void> {
    await this.send({
      type: 'in_app',
      recipient: userId,
      subject: 'Verification Complete',
      message: `Your verification job ${jobId} completed with score ${score}%`,
      data: { jobId, score },
    });
  }

  async sendTeamInvite(email: string, orgName: string, inviteCode: string): Promise<void> {
    await this.send({
      type: 'email',
      recipient: email,
      subject: `You've been invited to join ${orgName} on TruthEngine`,
      message: `Click here to join: https://truthengine.ai/join/${inviteCode}`,
    });
  }
}
