/**
 * Netlify Function: Submit Memorial Tribute
 * Handles tribute submissions with automatic content moderation
 */

const admin = require('firebase-admin');
const { moderateContent, getCrisisResources, getRejectionMessage } = require('./utils/contentModeration');
const { sendUrgentAlert } = require('./utils/emailService');

// Initialize Firebase Admin (reuse if already initialized)
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
    const { name, message, email } = data;

    // Validation
    if (!name || typeof name !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Name is required' })
      };
    }

    if (!message || typeof message !== 'string') {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message is required' })
      };
    }

    const trimmedName = name.trim();
    const trimmedMessage = message.trim();

    if (trimmedName.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Name cannot be empty' })
      };
    }

    if (trimmedMessage.length === 0) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message cannot be empty' })
      };
    }

    if (trimmedMessage.length > 1000) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Message cannot exceed 1000 characters' })
      };
    }

    // Validate email if provided
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Invalid email address' })
      };
    }

    // MODERATE CONTENT (check both name and message)
    const fullText = `${trimmedName} ${trimmedMessage}`;
    const moderation = moderateContent(fullText, 'tribute');

    // Prepare tribute document
    const tributeDoc = {
      name: trimmedName,
      message: trimmedMessage,
      email: email?.trim() || null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      status: moderation.status,
      approved: moderation.approved || false,
      rejected: moderation.rejected || false,
      moderationResult: moderation.reason,
      ipAddress: event.headers['x-forwarded-for'] || event.headers['client-ip'] || 'unknown',
      submittedFrom: 'memorial-wall'
    };

    // Handle based on moderation action
    if (moderation.action === 'flag-urgent') {
      // CRISIS CONTENT - Flag urgent and show resources
      tributeDoc.crisisResourcesShown = true;
      tributeDoc.flagReason = moderation.flagReason;
      tributeDoc.detectedKeywords = moderation.matches;

      // Save to database
      const docRef = await db.collection('tributes').add(tributeDoc);

      // Send urgent email alert via Zoho SMTP
      await sendUrgentAlert({ ...tributeDoc, name: trimmedName, message: trimmedMessage, email, id: docRef.id }, moderation, 'tribute');

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
          tributeReceived: true
        })
      };

    } else if (moderation.action === 'reject') {
      // OFFENSIVE/DISRESPECTFUL CONTENT - Auto-reject, do NOT save to database
      const rejectionInfo = getRejectionMessage(moderation.reason, 'tribute');

      // Optionally log rejected submissions for monitoring
      await db.collection('rejected_tributes').add({
        ...tributeDoc,
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
      const docRef = await db.collection('tributes').add(tributeDoc);

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          success: true,
          message: 'Your tribute has been received and is pending review. Thank you for honoring their memory.',
          tributeId: docRef.id
        })
      };
    }

  } catch (error) {
    console.error('Error processing tribute:', error);

    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({
        error: 'Failed to submit tribute. Please try again.',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      })
    };
  }
};
