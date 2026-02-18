import { Injectable, Logger } from "@nestjs/common";

/**
 * MailerService - Stub implementation for sending emails.
 * In production, integrate with SendGrid, AWS SES, Nodemailer, etc.
 */
@Injectable()
export class MailerService {
  private readonly logger = new Logger(MailerService.name);

  /**
   * Send an invitation email. Stub: logs the link instead of sending.
   */
  async sendInvitation(params: {
    to: string;
    inviterName: string;
    companyName: string;
    inviteLink: string;
    expiresAt: Date;
  }): Promise<void> {
    this.logger.log(
      `[STUB] Invitation email would be sent to ${params.to}: ` +
        `Join ${params.companyName} (invited by ${params.inviterName}). ` +
        `Link: ${params.inviteLink} (expires ${params.expiresAt.toISOString()})`,
    );
    // TODO: Integrate with real email provider
    // await this.transport.sendMail({ ... });
  }
}
