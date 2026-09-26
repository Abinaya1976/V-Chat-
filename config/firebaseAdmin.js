const { initializeApp, cert } = require('firebase-admin/app');
require('dotenv').config();

let isInitialized = false;

if (
  process.env.FIREBASE_PROJECT_ID &&
  process.env.FIREBASE_CLIENT_EMAIL &&
  process.env.FIREBASE_PRIVATE_KEY
) {
  try {
    // Replace literal '\n' strings with actual newlines if present in .env
    const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');

    initializeApp({
      credential: cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: privateKey,
      }),
    });
    isInitialized = true;
    console.log('[Firebase Admin] Initialized successfully via .env credentials.');
  } catch (error) {
    console.error('[Firebase Admin] Initialization error:', error.message);
  }
} else {
  console.warn('[Firebase Admin] Missing required environment variables. Push notifications will be disabled.');
}

module.exports = { isInitialized };
