const express = require('express');
const {
  register,
  login,
  getMe,
  getRegistrationStatus,
  resetPassword,
  inviteUser,
  getInvitation,
  setupPasswordFromInvite,
  getLoginAudit
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canCreateUsers, canViewLoginAudit } = require('../permissions/permissionEngine');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.get('/me', protect, getMe);

// Improved authentication: registration lock, invitation system, password
// setup, forced password reset, login audit (see authController.js and
// permissions/permissionEngine.js). All additive - nothing above was removed.
router.get('/registration-status', getRegistrationStatus);
router.post('/reset-password', protect, resetPassword);
router.post('/invite', protect, requirePermission(canCreateUsers), inviteUser);
router.get('/invite/:token', getInvitation);
router.post('/invite/:token/setup-password', setupPasswordFromInvite);
router.get('/login-audit', protect, requirePermission(canViewLoginAudit), getLoginAudit);

module.exports = router;
