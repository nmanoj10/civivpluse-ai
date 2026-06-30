import nodemailer from 'nodemailer';
import { logger } from '../../utils/logger';

/**
 * Phase 3.5 — Transactional email service
 *
 * Configuration: set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, EMAIL_PASS in server/.env
 * For testing: set EMAIL_FROM to a from-address and leave SMTP fields blank to use
 * Nodemailer's built-in test account (ethereal.email).
 *
 * Triggered on: COMMUNITY_VERIFIED, ASSIGNED_TO_AUTHORITY, CLOSED_RESOLVED
 * Recipients: issue reporter + IssueWatcher subscribers (Phase 3.3)
 */

let transporter: nodemailer.Transporter | null = null;

const getTransporter = async (): Promise<nodemailer.Transporter> => {
  if (transporter) return transporter;

  if (process.env.EMAIL_HOST && process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.EMAIL_HOST,
      port: parseInt(process.env.EMAIL_PORT || '587', 10),
      secure: process.env.EMAIL_SECURE === 'true',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });
    logger.info('EmailService', 'Transporter configured from ENV');
  } else {
    // Dev fallback: Ethereal test account
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: { user: testAccount.user, pass: testAccount.pass },
    });
    logger.info('EmailService', 'Using Ethereal test account', { user: testAccount.user });
  }

  return transporter;
};

export type EmailTransitionType = 'COMMUNITY_VERIFIED' | 'ASSIGNED_TO_AUTHORITY' | 'CLOSED_RESOLVED';

const EMAIL_SUBJECTS: Record<EmailTransitionType, string> = {
  COMMUNITY_VERIFIED: '✅ Community has verified your issue — CivicPulse',
  ASSIGNED_TO_AUTHORITY: '🏛️ Your issue has been assigned to an authority — CivicPulse',
  CLOSED_RESOLVED: '🎉 Your issue has been resolved — CivicPulse',
};

const EMAIL_BODIES: Record<EmailTransitionType, (issueTitle: string, issueId: string) => string> = {
  COMMUNITY_VERIFIED: (t, id) =>
    `Your issue "${t}" has been verified by the community and is now being routed to the relevant authority.\n\nView it at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/issues/${id}`,
  ASSIGNED_TO_AUTHORITY: (t, id) =>
    `Your issue "${t}" has been assigned to a ward authority who will begin work shortly.\n\nTrack progress at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/issues/${id}`,
  CLOSED_RESOLVED: (t, id) =>
    `Great news! Your issue "${t}" has been marked as resolved.\n\nView the resolution details at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/issues/${id}`,
};

/**
 * Send a transactional email for a key issue status transition.
 * Non-throwing — logs errors instead of crashing the main workflow.
 */
export const sendTransitionEmail = async (
  recipientEmail: string,
  transitionType: EmailTransitionType,
  issueTitle: string,
  issueId: string
): Promise<void> => {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || '"CivicPulse AI" <noreply@civicpulse.ai>',
      to: recipientEmail,
      subject: EMAIL_SUBJECTS[transitionType],
      text: EMAIL_BODIES[transitionType](issueTitle, issueId),
    });
    logger.info('EmailService', `Email sent: ${transitionType}`, {
      messageId: info.messageId,
      to: recipientEmail,
      preview: nodemailer.getTestMessageUrl(info) || undefined,
    });
  } catch (err: any) {
    // Non-fatal — log and continue
    logger.error('EmailService', `Failed to send email for ${transitionType}`, {
      to: recipientEmail,
      error: err?.message,
    });
  }
};

/**
 * Fan-out email to reporter + all IssueWatcher subscribers.
 */
export const fanOutTransitionEmails = async (
  issueId: string,
  issueTitle: string,
  reporterEmail: string,
  transitionType: EmailTransitionType
): Promise<void> => {
  try {
    const { IssueWatcher } = await import('../issues/issueWatcher.model');
    const { User } = await import('../users/user.model');

    const watchers = await IssueWatcher.find({ issueId }).lean();
    const watcherIds = watchers.map(w => w.userId);
    const watcherUsers = await User.find({ _id: { $in: watcherIds } }).select('email').lean();
    const watcherEmails = watcherUsers.map(u => u.email);

    const allRecipients = Array.from(new Set([reporterEmail, ...watcherEmails]));

    await Promise.allSettled(
      allRecipients.map(email => sendTransitionEmail(email, transitionType, issueTitle, issueId))
    );
  } catch (err: any) {
    logger.error('EmailService', 'Fan-out email failed', { issueId, error: err?.message });
  }
};

export const sendEscalationEmail = async (
  recipientEmail: string,
  issueTitle: string,
  issueId: string,
  level: number,
  reason: string
): Promise<void> => {
  try {
    const t = await getTransporter();
    const info = await t.sendMail({
      from: process.env.EMAIL_FROM || '"CivicPulse AI" <noreply@civicpulse.ai>',
      to: recipientEmail,
      subject: `🚨 [ESCALATION LEVEL ${level}] SLA Breach: ${issueTitle}`,
      text: `Alert: The issue "${issueTitle}" has breached its SLA.\n\nEscalation Level: ${level}\nReason: ${reason}\n\nTrack progress or take action at: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/issues/${issueId}`,
    });
    logger.info('EmailService', `Escalation level ${level} email sent`, {
      messageId: info.messageId,
      to: recipientEmail,
    });
  } catch (err: any) {
    logger.error('EmailService', `Failed to send escalation email for level ${level}`, {
      to: recipientEmail,
      error: err?.message,
    });
  }
};
