// SendGrid email service for password reset functionality
import { MailService } from '@sendgrid/mail';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

const mailService = new MailService();
mailService.setApiKey(process.env.SENDGRID_API_KEY);

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  try {
    await mailService.send({
      to: params.to,
      from: params.from,
      subject: params.subject,
      text: params.text || '',
      html: params.html || '',
    });
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    return false;
  }
}

export function generatePasswordResetEmail(
  recipientEmail: string,
  resetToken: string,
  userFirstName?: string
): EmailParams {
  const baseUrl = process.env.REPLIT_DOMAINS?.split(',')[0] 
    ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}`
    : 'http://localhost:5000';
  
  const resetUrl = `${baseUrl}/?reset-token=${resetToken}`;
  const greeting = userFirstName ? `Hi ${userFirstName}` : 'Hello';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password - Global Advisor</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
        .logo { color: #2563eb; font-size: 24px; font-weight: bold; }
        .content { padding: 30px 0; }
        .button { display: inline-block; background: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 14px; }
        .warning { background: #fef3cd; border: 1px solid #fde68a; border-radius: 6px; padding: 15px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🌍 Global Advisor</div>
        </div>
        
        <div class="content">
          <h2>${greeting},</h2>
          
          <p>We received a request to reset the password for your Global Advisor account associated with <strong>${recipientEmail}</strong>.</p>
          
          <p>Click the button below to reset your password:</p>
          
          <p style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" class="button">Reset Your Password</a>
          </p>
          
          <p>Or copy and paste this link into your browser:</p>
          <p style="word-break: break-all; color: #666; font-size: 14px;">${resetUrl}</p>
          
          <div class="warning">
            <strong>⚠️ Security Notice:</strong><br>
            • This link will expire in 30 minutes<br>
            • If you didn't request this reset, please ignore this email<br>
            • For your security, we recommend using a strong, unique password
          </div>
          
          <p>If you're having trouble clicking the button, copy and paste the URL above into your web browser.</p>
        </div>
        
        <div class="footer">
          <p>This email was sent by Global Advisor. If you didn't request a password reset, you can safely ignore this email.</p>
          <p>For security reasons, this link will expire in 30 minutes.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${greeting},

We received a request to reset the password for your Global Advisor account (${recipientEmail}).

To reset your password, visit this link:
${resetUrl}

⚠️ Security Notice:
- This link will expire in 30 minutes
- If you didn't request this reset, please ignore this email
- For your security, use a strong, unique password

If you're having trouble with the link, copy and paste it into your web browser.

---
Global Advisor
This email was sent because a password reset was requested for your account.
For security reasons, this link will expire in 30 minutes.
  `;

  return {
    to: recipientEmail,
    from: 'noreply@ofisca.com', // You may need to verify this domain with SendGrid
    subject: 'Reset Your Password - Global Advisor',
    text: textContent,
    html: htmlContent,
  };
}

export function generatePasswordResetConfirmationEmail(
  recipientEmail: string,
  userFirstName?: string
): EmailParams {
  const greeting = userFirstName ? `Hi ${userFirstName}` : 'Hello';
  
  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Password Successfully Reset - Global Advisor</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; padding: 20px 0; border-bottom: 1px solid #eee; }
        .logo { color: #2563eb; font-size: 24px; font-weight: bold; }
        .content { padding: 30px 0; }
        .success { background: #d1fae5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 15px; margin: 20px 0; color: #065f46; }
        .footer { text-align: center; padding: 20px 0; border-top: 1px solid #eee; color: #666; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <div class="logo">🌍 Global Advisor</div>
        </div>
        
        <div class="content">
          <h2>${greeting},</h2>
          
          <div class="success">
            <strong>✅ Password Reset Successful</strong><br>
            Your password has been successfully updated.
          </div>
          
          <p>Your Global Advisor account password was successfully reset on ${new Date().toLocaleString()}.</p>
          
          <p>You can now sign in to your account using your new password.</p>
          
          <p><strong>If you didn't make this change:</strong><br>
          Please contact our support team immediately, as your account may have been compromised.</p>
        </div>
        
        <div class="footer">
          <p>This is a security notification from Global Advisor.</p>
          <p>If you have any concerns about your account security, please contact support.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textContent = `
${greeting},

✅ Password Reset Successful

Your Global Advisor account password was successfully reset on ${new Date().toLocaleString()}.

You can now sign in to your account using your new password.

If you didn't make this change:
Please contact our support team immediately, as your account may have been compromised.

---
Global Advisor
This is a security notification. If you have concerns about your account, please contact support.
  `;

  return {
    to: recipientEmail,
    from: 'noreply@ofisca.com',
    subject: 'Password Successfully Reset - Global Advisor',
    text: textContent,
    html: htmlContent,
  };
}