/**
 * Email Service using Nodemailer with Zoho SMTP
 */

const nodemailer = require('nodemailer');

/**
 * Create and configure SMTP transporter
 */
function createTransporter() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: false, // true for 465, false for other ports (587 uses STARTTLS)
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    },
    tls: {
      rejectUnauthorized: true
    }
  });
}

/**
 * Send urgent alert email for crisis content
 * @param {Object} submission - Submission data (whisper or tribute)
 * @param {Object} moderation - Moderation result
 * @param {string} type - Type of submission ('whisper' or 'tribute')
 */
async function sendUrgentAlert(submission, moderation, type = 'whisper') {
  try {
    const transporter = createTransporter();

    const typeLabel = type === 'tribute' ? 'Memorial Tribute' : 'Whisper';
    const dashboardUrl = 'https://vaelorinverse.com/admin/dashboard.html';

    const mailOptions = {
      from: `"VaelorinVerse Alerts" <${process.env.SMTP_FROM}>`,
      to: process.env.ADMIN_EMAIL,
      subject: `🚨 URGENT: Crisis Language Detected in ${typeLabel}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .alert-header { background: #ef4444; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
    .alert-body { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; }
    .content-box { background: white; padding: 15px; border-left: 4px solid #ef4444; margin: 15px 0; }
    .meta-row { display: flex; justify-content: space-between; margin: 10px 0; }
    .label { font-weight: 600; color: #6b7280; }
    .value { color: #111827; }
    .actions-list { background: #fef3c7; padding: 15px; border-radius: 6px; margin: 15px 0; }
    .actions-list ul { margin: 10px 0; padding-left: 20px; }
    .btn { display: inline-block; background: #fbbf24; color: #000; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 600; margin-top: 15px; }
    .keywords { background: #fee2e2; padding: 10px; border-radius: 6px; color: #991b1b; }
  </style>
</head>
<body>
  <div class="container">
    <div class="alert-header">
      <h1 style="margin: 0; font-size: 24px;">🚨 URGENT ${typeLabel.toUpperCase()} ALERT</h1>
    </div>

    <div class="alert-body">
      <div class="meta-row">
        <span class="label">Status:</span>
        <span class="value" style="color: #ef4444; font-weight: 600;">Requires Immediate Review</span>
      </div>

      <div class="meta-row">
        <span class="label">Reason:</span>
        <span class="value">${moderation.reason}</span>
      </div>

      <div class="meta-row">
        <span class="label">Submitted:</span>
        <span class="value">${new Date().toLocaleString()}</span>
      </div>

      ${type === 'tribute' ? `
      <div class="meta-row">
        <span class="label">Name:</span>
        <span class="value">${submission.name}</span>
      </div>
      ${submission.email ? `
      <div class="meta-row">
        <span class="label">Email:</span>
        <span class="value">${submission.email}</span>
      </div>` : ''}
      ` : ''}

      <h3 style="margin-top: 20px;">${type === 'tribute' ? 'Tribute Message:' : 'Whisper Content:'}</h3>
      <div class="content-box">
        "${type === 'tribute' ? submission.message : submission.text}"
      </div>

      <h3>Detected Keywords:</h3>
      <div class="keywords">
        ${moderation.matches?.join(', ') || 'N/A'}
      </div>

      <div class="actions-list">
        <h3 style="margin-top: 0;">✅ Actions Taken:</h3>
        <ul>
          <li>Crisis resources automatically shown to user</li>
          <li>Submission flagged for urgent review</li>
          <li>Admin notification sent (this email)</li>
          <li>Saved to database with urgent status</li>
        </ul>
      </div>

      <div style="text-align: center; margin-top: 20px;">
        <a href="${dashboardUrl}" class="btn">View in Dashboard</a>
      </div>

      <p style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 14px;">
        This is an automated alert from the VaelorinVerse content moderation system.
      </p>
    </div>
  </div>
</body>
</html>
      `
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Urgent alert email sent:', info.messageId);
    return { success: true, messageId: info.messageId };

  } catch (error) {
    console.error('Error sending urgent alert email:', error);
    // Don't throw - we don't want email failures to block the submission
    return { success: false, error: error.message };
  }
}

/**
 * Test email configuration
 */
async function testEmailConfig() {
  try {
    const transporter = createTransporter();
    await transporter.verify();
    console.log('✅ SMTP configuration verified successfully');
    return true;
  } catch (error) {
    console.error('❌ SMTP configuration error:', error);
    return false;
  }
}

module.exports = {
  sendUrgentAlert,
  testEmailConfig
};
