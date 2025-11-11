/**
 * Netlify Function: Submit Whisper
 * Handles whisper submissions with automatic content moderation
 *
 * FIX APPLIED: Removed "await" from email functions (lines 101 & 142)
 * to prevent 10-second delays on mobile. Emails now send in background.
 */

const admin = require('firebase-admin');
const { moderateContent, getCrisisResources, getRejectionMessage } = require('./utils/contentModeration');
const { sendUrgentAlert, sendGeneralNotification } = require('./utils/emailService');

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

    // MODERATE CONTENT (ultra-fast keyword detection <5ms)
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

      // Send urgent email alert via Zoho SMTP (background - don't block response)
      sendUrgentAlert({ ...whisperDoc, text: trimmedText, id: docRef.id }, moderation, 'whisper').catch(err => {
        console.error('Background email error (non-critical):', err);
      });

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

      // Send general notification email to INFO_EMAIL (background - don't block response)
      sendGeneralNotification({ ...whisperDoc, text: trimmedText, id: docRef.id }, 'whisper').catch(err => {
        console.error('Background email error (non-critical):', err);
      });

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
