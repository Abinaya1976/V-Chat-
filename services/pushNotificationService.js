const { isInitialized } = require('../config/firebaseAdmin');
const { getMessaging } = require('firebase-admin/messaging');
const User = require('../models/User');

/**
 * Sends a push notification to a specific user's FCM tokens
 * Automatically removes invalid or expired tokens from the user's record
 * 
 * @param {string} userId - The MongoDB User ID
 * @param {Object} payload - The notification payload ({ title, body, data })
 */
const sendPushToUser = async (userId, payload) => {
  if (!isInitialized) return { success: false, error: 'Firebase Admin not initialized' };

  try {
    const user = await User.findById(userId).select('fcmTokens');
    if (!user || !user.fcmTokens || user.fcmTokens.length === 0) {
      return { success: false, error: 'No FCM tokens found for user' };
    }

    const message = {
      tokens: user.fcmTokens,
    };

    if (payload.title || payload.body) {
      message.notification = {
        title: payload.title || 'New Notification',
        body: payload.body || '',
      };
    }

    if (payload.data && Object.keys(payload.data).length > 0) {
      message.data = payload.data;
    }

    const response = await getMessaging().sendEachForMulticast(message);
    
    // Check for failed tokens to clean up
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const errorCode = resp.error?.code;
          if (
            errorCode === 'messaging/invalid-registration-token' ||
            errorCode === 'messaging/registration-token-not-registered'
          ) {
            failedTokens.push(user.fcmTokens[idx]);
          }
        }
      });

      if (failedTokens.length > 0) {
        // Remove invalid tokens from the user's array
        await User.findByIdAndUpdate(userId, {
          $pullAll: { fcmTokens: failedTokens },
        });
        console.log(`[FCM] Cleaned up ${failedTokens.length} invalid tokens for user ${userId}`);
      }
    }

    return { success: true, successCount: response.successCount, failureCount: response.failureCount };
  } catch (error) {
    console.error('[FCM] Push Notification Error:', error.message);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPushToUser,
};
