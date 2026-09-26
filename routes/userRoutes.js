const express = require('express');
const router = express.Router();
const {
  getTeamUsers,
  getProfile,
  updateProfile,
  updateSettings,
  pinItem,
  unpinItem,
  updateFcmToken,
  testFcmPush,
} = require('../controllers/userController');
const { protect } = require('../middleware/authMiddleware');
const { requireActiveOrg, requireApprovedOrg } = require('../middleware/featureMiddleware');
const { handleUpload } = require('../middleware/uploadMiddleware');

// Protected routes
router.use(protect);

router.get('/', requireApprovedOrg, getTeamUsers);
router.get('/profile', getProfile);
router.put('/profile', handleUpload('avatar', 1), updateProfile);
router.patch('/profile', handleUpload('avatar', 1), updateProfile);
router.put('/settings', updateSettings);
router.patch('/settings', updateSettings);
router.post('/pin-item', pinItem);
router.post('/unpin-item', unpinItem);
router.post('/fcm-token', updateFcmToken);
router.post('/test-fcm-push', testFcmPush);

module.exports = router;
