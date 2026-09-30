/**
 * Centralized Plan & Subscription Entitlements Configuration for ChatApp
 * Defines Free and Professional plan quotas, limits, and helper functions.
 */

const PLANS = {
  FREE: 'free',
  PROFESSIONAL: 'professional',
};

const PLAN_ENTITLEMENTS = {
  [PLANS.FREE]: {
    name: 'Free',
    code: 'free',
    priceINR: 0,
    maxMembers: 20, // Maximum 20 members (blocks member #21)
    maxChannels: 10, // Maximum 10 channels (blocks channel #11)
    // maxFileSizeBytes: 50 * 1024 * 1024, // 50 MB per file (PRODUCTION)
    // maxFileSizeMB: 50, // (PRODUCTION)
    maxFileSizeBytes: 250 * 1024 * 1024, // 250 MB per file (LOCAL TESTING)
    maxFileSizeMB: 250, // (LOCAL TESTING)
    storagePerUser: false, // Shared workspace storage
    sharedStorageBytes: 10 * 1024 * 1024 * 1024, // 10 GB shared storage (PRODUCTION)
    sharedStorageGB: 10, // (PRODUCTION)
    // sharedStorageBytes: 1 * 1024 * 1024 * 1024, // 1 GB shared storage (LOCAL TESTING)
    // sharedStorageGB: 1, // (LOCAL TESTING)
    messageHistoryDays: 100, // 100-day rolling history/search
    features: {
      publicChannels: true,
      privateChannels: true,
      customEmoji: false,
    },
  },
  [PLANS.PROFESSIONAL]: {
    name: 'Professional',
    code: 'professional',
    priceINR: 100, // ₹100 / user / month
    maxMembers: null, // Unlimited members
    maxChannels: null, // Unlimited channels
    // maxFileSizeBytes: 200 * 1024 * 1024, // 200 MB per file (PRODUCTION)
    // maxFileSizeMB: 200, // (PRODUCTION)
    maxFileSizeBytes: 250 * 1024 * 1024, // 250 MB per file (LOCAL TESTING)
    maxFileSizeMB: 250, // (LOCAL TESTING)
    storagePerUser: true, // 10 GB per user
    storagePerUserBytes: 10 * 1024 * 1024 * 1024, // 10 GB per user (PRODUCTION)
    storagePerUserGB: 10, // (PRODUCTION)
    // storagePerUserBytes: 1 * 1024 * 1024 * 1024, // 1 GB per user (LOCAL TESTING)
    // storagePerUserGB: 1, // (LOCAL TESTING)
    messageHistoryDays: null, // Unlimited / permanent history
    features: {
      publicChannels: true,
      privateChannels: true,
      customEmoji: true,
    },
  },
};

/**
 * Normalizes plan code string safely to 'free' or 'professional'
 * @param {string} planStr
 * @returns {string} 'free' | 'professional'
 */
function normalizePlanCode(planStr) {
  if (!planStr) return PLANS.FREE;
  const lower = String(planStr).toLowerCase().trim();
  if (lower === PLANS.PROFESSIONAL) return PLANS.PROFESSIONAL;
  return PLANS.FREE;
  
}

/**
 * Gets entitlements configuration object for a given plan
 * @param {string} planStr
 * @returns {Object}
 */
function getPlanEntitlements(planStr) {
  const code = normalizePlanCode(planStr);
  return PLAN_ENTITLEMENTS[code];
}

/**
 * Calculates total storage quota (in bytes) allowed for an organization based on its plan and user count
 * @param {string} planStr
 * @param {number} userCount
 * @returns {number} Storage quota in bytes
 */
function getOrganizationStorageLimitBytes(planStr, userCount = 1) {
  const entitlements = getPlanEntitlements(planStr);
  if (entitlements.storagePerUser) {
    const validUserCount = Math.max(1, parseInt(userCount, 10) || 1);
    return validUserCount * entitlements.storagePerUserBytes;
  }
  return entitlements.sharedStorageBytes;
}

/**
 * Returns rolling message cutoff date if plan has messageHistoryDays restriction, or null if permanent
 * @param {string} planStr
 * @returns {Date|null}
 */
function getMessageHistoryCutoffDate(planStr) {
  const entitlements = getPlanEntitlements(planStr);
  if (entitlements.messageHistoryDays && typeof entitlements.messageHistoryDays === 'number') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - entitlements.messageHistoryDays);
    return cutoff;
  }
  return null;
}

module.exports = {
  PLANS,
  PLAN_ENTITLEMENTS,
  normalizePlanCode,
  getPlanEntitlements,
  getOrganizationStorageLimitBytes,
  getMessageHistoryCutoffDate,
};
