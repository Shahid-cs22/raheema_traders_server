const nodemailer = require('nodemailer');

let cachedTransporter = null;

/**
 * Get or create the Nodemailer transporter.
 * Supports SMTP (e.g. Gmail App Passwords). Ethereal is available only in
 * development; production never reports a test mailbox as a delivered email.
 */
const getTransporter = async () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const host = (process.env.EMAIL_HOST || process.env.SMTP_HOST || '').trim();
  const portValue = process.env.EMAIL_PORT || process.env.SMTP_PORT || '587';
  const port = Number(portValue);
  const user = (process.env.EMAIL_USER || process.env.SMTP_USER || '').trim();
  let pass = (process.env.EMAIL_PASS || process.env.SMTP_PASS || '').trim();
  const secureValue = process.env.EMAIL_SECURE?.trim() || undefined;
  if (secureValue !== undefined && !['true', 'false'].includes(secureValue.toLowerCase())) {
    throw new Error('Invalid SMTP configuration: EMAIL_SECURE must be true or false.');
  }
  const secure = secureValue === undefined ? port === 465 : secureValue.toLowerCase() === 'true';
  if (/\.gmail\.com$/i.test(host)) pass = pass.replace(/\s+/g, '');

  if (user || pass || host) {
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass) {
      throw new Error('Invalid SMTP configuration: set a valid EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS together.');
    }

    cachedTransporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: {
        user,
        pass,
      },
    });

    console.log(`[Email Service]: Configured SMTP transporter with ${host}:${port}`);
    return cachedTransporter;
  }

  if (process.env.NODE_ENV !== 'development') {
    throw new Error('SMTP is not configured. Set EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS before sending email.');
  }

  // Development-only fallback: generate an Ethereal test account.
  try {
    console.log('[Email Service]: SMTP credentials are absent; initializing a development Ethereal test account.');
    const testAccount = await nodemailer.createTestAccount();
    cachedTransporter = nodemailer.createTransport({
      host: testAccount.smtp.host,
      port: testAccount.smtp.port,
      secure: testAccount.smtp.secure,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log(`[Email Service]: Ethereal dev mailbox ready (${testAccount.user})`);
    return cachedTransporter;
  } catch (err) {
    throw new Error(`Could not create development Ethereal account: ${err.message}`);
  }
};

/**
 * Base send email function
 */
const sendEmail = async ({ to, subject, html, text }) => {
  if (!to || !subject || (!html && !text)) {
    throw new Error('Email requires a recipient, subject, and either HTML or text content.');
  }

  try {
    const transporter = await getTransporter();
    const from =
      process.env.EMAIL_FROM ||
      `"Raheema Traders Admin" <${process.env.EMAIL_USER || 'no-reply@raheematraders.com'}>`;

    const mailOptions = {
      from,
      to,
      subject,
      text: text || String(html || '').replace(/<[^>]*>?/gm, ''),
      html,
    };

    const info = await transporter.sendMail(mailOptions);

    console.log(`[Email Service]: Message sent to ${to} (Message ID: ${info.messageId})`);

    // In dev / ethereal mode, log the preview URL
    const previewUrl = nodemailer.getTestMessageUrl(info);
    if (previewUrl) {
      console.log(`[Email Service]: ✉️  Preview URL: ${previewUrl}`);
    }

    return { success: true, messageId: info.messageId, previewUrl };
  } catch (error) {
    console.error(`[Email Service Error]: Failed to send email to ${to}:`, error.message);
    throw error;
  }
};

/**
 * Brand wrapper for HTML emails (Obsidian & Gold theme)
 */
const wrapEmailTemplate = ({ headline, greeting, bodyContent, buttonText, buttonUrl, subtext }) => {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${headline}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #07090e; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #f4f4f5; }
    .container { max-width: 600px; margin: 40px auto; background-color: #0e121a; border: 1px solid rgba(245, 158, 11, 0.25); border-radius: 20px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .header { background: linear-gradient(180deg, #161c28 0%, #0e121a 100%); padding: 32px 24px; text-align: center; border-bottom: 1px solid rgba(245, 158, 11, 0.15); }
    .brand-title { color: #f59e0b; font-size: 20px; font-weight: 900; letter-spacing: 2px; text-transform: uppercase; margin: 0; }
    .brand-subtitle { color: #a1a1aa; font-size: 11px; text-transform: uppercase; letter-spacing: 1.5px; margin-top: 4px; }
    .content { padding: 36px 32px; }
    .greeting { font-size: 16px; font-weight: 700; color: #ffffff; margin-top: 0; margin-bottom: 16px; }
    .paragraph { font-size: 14px; line-height: 1.6; color: #d4d4d8; margin-bottom: 24px; }
    .button-container { text-align: center; margin: 32px 0; }
    .button { display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #07090e !important; text-decoration: none; font-size: 13px; font-weight: 900; text-transform: uppercase; letter-spacing: 1.5px; padding: 14px 32px; border-radius: 12px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.35); }
    .fallback-link { font-size: 11px; color: #71717a; word-break: break-all; margin-top: 24px; line-height: 1.5; padding: 12px; background-color: #07090e; border-radius: 8px; border: 1px solid #1f293d; }
    .fallback-link a { color: #f59e0b; text-decoration: none; }
    .footer { padding: 24px 32px; background-color: #07090e; border-top: 1px solid #1f293d; text-align: center; font-size: 11px; color: #71717a; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-title">RAHEEMA TRADERS</div>
      <div class="brand-subtitle">Footwear Admin Security Portal • Karungal</div>
    </div>
    <div class="content">
      <div class="greeting">${greeting}</div>
      <div class="paragraph">${bodyContent}</div>
      ${
        buttonUrl && buttonText
          ? `
      <div class="button-container">
        <a href="${buttonUrl}" class="button" target="_blank">${buttonText}</a>
      </div>
      <div class="fallback-link">
        If the button above does not work, copy and paste this link into your browser:<br />
        <a href="${buttonUrl}">${buttonUrl}</a>
      </div>
      `
          : ''
      }
      ${subtext ? `<div class="paragraph" style="margin-top: 24px; font-size: 12px; color: #a1a1aa;">${subtext}</div>` : ''}
    </div>
    <div class="footer">
      This is an automated administrative notification from Raheema Traders Footwear.<br />
      If you did not make this request, please contact the superadmin immediately.
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Send email verification link to admin
 */
const sendVerificationEmail = async ({ to, name, verificationUrl }) => {
  const html = wrapEmailTemplate({
    headline: 'Verify Admin Email Address',
    greeting: `Hello, ${name || 'Administrator'}!`,
    bodyContent: `
      Thank you for securing your Raheema Traders administrator account.
      Please verify your email address to enable all administrative management privileges.
      This verification link is valid for <strong>24 hours</strong>.
    `,
    buttonText: 'Verify My Email Address',
    buttonUrl: verificationUrl,
    subtext: 'If you did not register or update an admin account on Raheema Traders, you can safely ignore this email.',
  });

  return await sendEmail({
    to,
    subject: 'Action Required: Verify your Raheema Traders Admin Email',
    html,
  });
};

/**
 * Send password reset link to admin
 */
const sendPasswordResetEmail = async ({ to, name, resetUrl }) => {
  const html = wrapEmailTemplate({
    headline: 'Password Reset Request',
    greeting: `Hello, ${name || 'Administrator'}!`,
    bodyContent: `
      We received a request to reset the password for your Raheema Traders administrator account.
      Click the button below to choose a new password. This secure link is valid for <strong>15 minutes</strong>.
    `,
    buttonText: 'Reset Password',
    buttonUrl: resetUrl,
    subtext: 'If you did not request a password reset, please ignore this email or check your account security. Your current password remains active.',
  });

  return await sendEmail({
    to,
    subject: 'Urgent: Password Reset Request for Raheema Traders Admin',
    html,
  });
};

/**
 * Send confirmation email after password reset
 */
const sendPasswordResetSuccessEmail = async ({ to, name }) => {
  const html = wrapEmailTemplate({
    headline: 'Password Reset Successful',
    greeting: `Hello, ${name || 'Administrator'}!`,
    bodyContent: `
      The password for your Raheema Traders administrator account has been successfully updated.
      You can now log in with your new password.
    `,
    buttonText: 'Go to Admin Login',
    buttonUrl: `${process.env.CLIENT_URL || 'http://localhost:5173'}/admin/login`,
    subtext: 'If you did not make this change, please contact the superadmin immediately to secure your account.',
  });

  return await sendEmail({
    to,
    subject: 'Security Alert: Your Raheema Traders Admin Password Was Changed',
    html,
  });
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendPasswordResetEmail,
  sendPasswordResetSuccessEmail,
};
