/**
 * Netlify Function: Submit Whisper
 * Handles whisper submissions with automatic content moderation
 */

const admin = require('firebase-admin');
const { moderateContent, getCrisisResources, getRejectionMessage } = require('./utils/contentModeration');

// Initialize Firebase Admin (only once)
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

/**
 * Send email notification for urgent content
 * @param {Object} whisper - Whisper data
 * @param {Object} moderation - Moderation result
 */
async function sendUrgentAlert(whisper, moderation) {
  // Using Netlify's built-in email or a service like SendGrid
  // You'll need to configure this based on your email service

  const emailData = {
    to: process.env.ADMIN_EMAIL,
    subject: '🚨 URGENT: Crisis Language Detected in Whisper Submission',
    html: `
      <h2 style="color: #ef4444;">🚨 URGENT WHISPER ALERT</h2>
      <p><strong>Status:</strong> Requires immediate review</p>
      <p><strong>Reason:</strong> ${moderation.reason}</p>
      <p><strong>Submitted:</strong> ${new Date().toLocaleString()}</p>

      <h3>Whisper Content:</h3>
      <blockquote style="background: #f3f4f6; padding: 1rem; border-left: 4px solid #ef4444;">
        "${whisper.text}"
      </blockquote>

      <h3>Detected Keywords:</h3>
      <p>${moderation.matches?.join(', ') || 'N/A'}</p>

      <h3>Actions Taken:</h3>
      <ul>
        <li>✅ Crisis resources automatically shown to user</li>
        <li>✅ Submission flagged for urgent review</li>
        <li>✅ Admin notification sent</li>
      </ul>

      <p><a href="https://vaelorinverse.com/admin/dashboard.html" style="background: #fbbf24; color: #000; padding: 0.75rem 1.5rem; text-decoration: none; border-radius: 6px; display: inline-block; margin-top: 1rem;">View in Dashboard</a></p>
    `
  };

  // TODO: Implement email sending based on your service
  // Example with SendGrid, Mailgun, or Netlify Forms
  console.log('URGENT EMAIL ALERT:', emailData);

  // If using SendGrid:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // await sgMail.send(emailData);
}

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  };

  // Handle preflight
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const data = JSON.parse(event.body);
    const { text } = data;

    // Validation
    if (!text || typeof text !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Whisper text is required' })
      };
    }

    const trimmedText = text.trim();

    if (trimmedText.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Whisper cannot be empty' })
      };
    }

    if (trimmedText.length > 280) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Whisper cannot exceed 280 characters' })
      };
    }

    // MODERATE CONTENT
    const moderation = moderateContent(trimmedText, 'whisper');

    // Prepare whisper document
    const whisperDoc = {
      text: trimmedText,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      status: moderation.status,
      approved: moderation.approved || false,
      rejected: moderation.rejected || false,
      moderationResult: moderation.reason,
      ipAddress: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown'
    };

    // Handle based on moderation action
    if (moderation.action === 'flag-urgent') {
      // CRISIS CONTENT - Flag urgent and show resources
      whisperDoc.crisisResourcesShown = true;
      whisperDoc.flagReason = moderation.flagReason;
      whisperDoc.detectedKeywords = moderation.matches;

      // Save to database
      const docRef = await db.collection('whispers').add(whisperDoc);

      // Send urgent email alert
      await sendUrgentAlert({ ...whisperDoc, id: docRef.id }, moderation);

      // Return crisis resources to user
      const crisisResources = getCrisisResources();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          urgent: true,
          message: crisisResources.message,
          resources: crisisResources.resources,
          closingMessage: crisisResources.closingMessage,
          whisperReceived: true
        })
      };

    } else if (moderation.action === 'reject') {
      // OFFENSIVE CONTENT - Auto-reject, do NOT save to database
      const rejectionInfo = getRejectionMessage(moderation.reason, 'whisper');

      // Optionally log rejected submissions for monitoring
      await db.collection('rejected_whispers').add({
        ...whisperDoc,
        rejectionReason: moderation.rejectionReason,
        detectedKeywords: moderation.matches,
        rejectedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      return {
        statusCode: 400,
        headers,
        body: JSON.stringify(rejectionInfo)
      };

    } else {
      // CLEAN CONTENT - Pending review
      const docRef = await db.collection('whispers').add(whisperDoc);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Your whisper has been received and is pending review. Thank you for sharing.',
          whisperId: docRef.id
        })
      };
    }

  } catch (error) {
    console.error('Error processing whisper:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to submit whisper. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
