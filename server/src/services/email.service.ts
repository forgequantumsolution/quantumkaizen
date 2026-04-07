import nodemailer from 'nodemailer';
import config from '../config/index.js';
import logger from '../config/logger.js';

// ─── Transporter Setup ───────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: config.smtp.host,
  port: config.smtp.port,
  secure: config.smtp.port === 465,
  auth:
    config.smtp.user && config.smtp.pass
      ? { user: config.smtp.user, pass: config.smtp.pass }
      : undefined,
  pool: true,
  maxConnections: 5,
  maxMessages: 100,
});

// Verify connection on startup (non-blocking)
transporter.verify().then(() => {
  logger.info('SMTP connection verified');
}).catch((err) => {
  logger.warn('SMTP connection not available — emails will fail', { error: err.message });
});

// ─── Send Email ──────────────────────────────────────────────────────
export async function sendEmail(
  to: string | string[],
  subject: string,
  html: string
): Promise<void> {
  try {
    const info = await transporter.sendMail({
      from: config.smtp.from,
      to: Array.isArray(to) ? to.join(', ') : to,
      subject: `[Quantum Kaizen] ${subject}`,
      html: wrapInLayout(html),
    });
    logger.info('Email sent', { messageId: info.messageId, to });
  } catch (error) {
    logger.error('Failed to send email', { error, to, subject });
    throw error;
  }
}

// ─── HTML Layout Wrapper ─────────────────────────────────────────────
function wrapInLayout(bodyContent: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
</head>
<body style="margin:0;padding:0;background:#f4f5f7;font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f5f7;padding:32px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1e40af,#7c3aed);padding:24px 32px;">
              <h1 style="margin:0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                Quantum Kaizen
              </h1>
              <p style="margin:4px 0 0;color:#c7d2fe;font-size:12px;">Enterprise Quality &amp; Compliance Platform</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:16px 32px;background:#f8f9fa;border-top:1px solid #e5e7eb;">
              <p style="margin:0;font-size:11px;color:#9ca3af;text-align:center;">
                This is an automated message from Quantum Kaizen. Please do not reply directly.
              </p>
              <p style="margin:4px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
                &copy; ${new Date().getFullYear()} Forge Quantum Solutions. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Email Templates ─────────────────────────────────────────────────

export function approvalRequiredTemplate(params: {
  recipientName: string;
  entityType: string;
  entityTitle: string;
  entityNumber: string;
  requestedBy: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Approval Required: ${params.entityType} — ${params.entityNumber}`,
    html: `
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;">Approval Required</h2>
      <p style="color:#475569;line-height:1.6;">
        Hello <strong>${params.recipientName}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;">
        A ${params.entityType.toLowerCase()} requires your review and approval:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#334155;width:140px;border:1px solid #e2e8f0;">Number</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${params.entityNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#334155;border:1px solid #e2e8f0;">Title</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${params.entityTitle}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#334155;border:1px solid #e2e8f0;">Requested By</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${params.requestedBy}</td>
        </tr>
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="${params.appUrl}" style="display:inline-block;padding:12px 32px;background:#1e40af;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
          Review Now
        </a>
      </p>
    `,
  };
}

export function recordOverdueTemplate(params: {
  recipientName: string;
  entityType: string;
  entityTitle: string;
  entityNumber: string;
  dueDate: string;
  daysPastDue: number;
}): { subject: string; html: string } {
  return {
    subject: `Overdue: ${params.entityType} ${params.entityNumber} (${params.daysPastDue} days)`,
    html: `
      <h2 style="margin:0 0 16px;color:#dc2626;font-size:18px;">Overdue Action</h2>
      <p style="color:#475569;line-height:1.6;">
        Hello <strong>${params.recipientName}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;">
        The following ${params.entityType.toLowerCase()} is now <strong style="color:#dc2626;">${params.daysPastDue} day(s) past due</strong>:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:8px 12px;background:#fef2f2;font-weight:600;color:#991b1b;width:140px;border:1px solid #fecaca;">Number</td>
          <td style="padding:8px 12px;border:1px solid #fecaca;color:#475569;">${params.entityNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#fef2f2;font-weight:600;color:#991b1b;border:1px solid #fecaca;">Title</td>
          <td style="padding:8px 12px;border:1px solid #fecaca;color:#475569;">${params.entityTitle}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#fef2f2;font-weight:600;color:#991b1b;border:1px solid #fecaca;">Due Date</td>
          <td style="padding:8px 12px;border:1px solid #fecaca;color:#475569;">${params.dueDate}</td>
        </tr>
      </table>
      <p style="color:#475569;line-height:1.6;">
        Please take immediate action to resolve this item or contact your quality manager.
      </p>
    `,
  };
}

export function recordAssignedTemplate(params: {
  recipientName: string;
  entityType: string;
  entityTitle: string;
  entityNumber: string;
  assignedBy: string;
  dueDate?: string;
  appUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Assigned: ${params.entityType} ${params.entityNumber}`,
    html: `
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;">New Assignment</h2>
      <p style="color:#475569;line-height:1.6;">
        Hello <strong>${params.recipientName}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;">
        You have been assigned a new ${params.entityType.toLowerCase()}:
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#334155;width:140px;border:1px solid #e2e8f0;">Number</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${params.entityNumber}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#334155;border:1px solid #e2e8f0;">Title</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${params.entityTitle}</td>
        </tr>
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#334155;border:1px solid #e2e8f0;">Assigned By</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${params.assignedBy}</td>
        </tr>
        ${params.dueDate ? `
        <tr>
          <td style="padding:8px 12px;background:#f1f5f9;font-weight:600;color:#334155;border:1px solid #e2e8f0;">Due Date</td>
          <td style="padding:8px 12px;border:1px solid #e2e8f0;color:#475569;">${params.dueDate}</td>
        </tr>` : ''}
      </table>
      <p style="text-align:center;margin:24px 0;">
        <a href="${params.appUrl}" style="display:inline-block;padding:12px 32px;background:#1e40af;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
          View Details
        </a>
      </p>
    `,
  };
}

export function passwordResetTemplate(params: {
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
}): { subject: string; html: string } {
  return {
    subject: 'Password Reset Request',
    html: `
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;">Password Reset</h2>
      <p style="color:#475569;line-height:1.6;">
        Hello <strong>${params.recipientName}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;">
        We received a request to reset your Quantum Kaizen password. Click the button below to set a new password:
      </p>
      <p style="text-align:center;margin:24px 0;">
        <a href="${params.resetUrl}" style="display:inline-block;padding:12px 32px;background:#1e40af;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
          Reset Password
        </a>
      </p>
      <p style="color:#475569;line-height:1.6;">
        This link will expire in <strong>${params.expiresInMinutes} minutes</strong>.
      </p>
      <p style="color:#94a3b8;font-size:13px;line-height:1.6;">
        If you did not request this password reset, please ignore this email. Your password will remain unchanged.
      </p>
    `,
  };
}

export function welcomeUserTemplate(params: {
  recipientName: string;
  email: string;
  tenantName: string;
  temporaryPassword?: string;
  loginUrl: string;
}): { subject: string; html: string } {
  return {
    subject: `Welcome to Quantum Kaizen — ${params.tenantName}`,
    html: `
      <h2 style="margin:0 0 16px;color:#1e293b;font-size:18px;">Welcome to Quantum Kaizen</h2>
      <p style="color:#475569;line-height:1.6;">
        Hello <strong>${params.recipientName}</strong>,
      </p>
      <p style="color:#475569;line-height:1.6;">
        Your account has been created for <strong>${params.tenantName}</strong> on the Quantum Kaizen platform.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr>
          <td style="padding:8px 12px;background:#f0fdf4;font-weight:600;color:#166534;width:140px;border:1px solid #bbf7d0;">Email</td>
          <td style="padding:8px 12px;border:1px solid #bbf7d0;color:#475569;">${params.email}</td>
        </tr>
        ${params.temporaryPassword ? `
        <tr>
          <td style="padding:8px 12px;background:#f0fdf4;font-weight:600;color:#166534;border:1px solid #bbf7d0;">Temporary Password</td>
          <td style="padding:8px 12px;border:1px solid #bbf7d0;color:#475569;font-family:monospace;">${params.temporaryPassword}</td>
        </tr>` : ''}
      </table>
      ${params.temporaryPassword ? '<p style="color:#dc2626;font-size:13px;">Please change your password after your first login.</p>' : ''}
      <p style="text-align:center;margin:24px 0;">
        <a href="${params.loginUrl}" style="display:inline-block;padding:12px 32px;background:#16a34a;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;">
          Log In Now
        </a>
      </p>
    `,
  };
}
