const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/authMiddleware');

// Wrap require in try-catch in case controller is not saved to disk yet
let livekitController;
try {
  livekitController = require('../controllers/livekitController');
} catch (error) {
  console.warn('⚠️ livekitController not found or has errors. Creating fallback route.');
}

if (livekitController && livekitController.generateToken) {
  router.post('/token', protect, livekitController.generateToken);
} else {
  router.post('/token', protect, (req, res) => {
    res.status(501).json({ success: false, message: 'LiveKit not fully implemented yet.' });
  });
}

module.exports = router;
