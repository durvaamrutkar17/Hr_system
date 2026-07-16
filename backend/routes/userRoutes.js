const express = require('express');
const {
  getUsers, getUserById, createEmployee, updateLeaveBalance,
  assignRole, forcePasswordReset
} = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const {
  canManageUsers, canViewEmployee, canCreateUsers, canForcePasswordReset
} = require('../permissions/permissionEngine');

const router = express.Router();

// Old middleware (kept for reference):
// router.get('/', protect, authorize('manager', 'admin'), getUsers);
// router.get('/:id', protect, authorize('manager', 'admin'), getUserById);
// router.post('/', protect, authorize('manager', 'admin'), createEmployee);
// router.patch('/:id/leave-balance', protect, authorize('manager', 'admin'), updateLeaveBalance);
router.get('/', protect, requirePermission(canManageUsers), getUsers);
// canViewEmployee also allows a user to fetch their own record (a pure
// widening vs. the old reviewer-only check - see permissionEngine.js).
router.get('/:id', protect, requirePermission(canViewEmployee, { paramKey: 'id' }), getUserById);
// Old gate (kept for reference - any manager or admin could create users):
// router.post('/', protect, requirePermission(canManageUsers), createEmployee);
// "Only Admin/HR can create users" - narrower than canManageUsers.
router.post('/', protect, requirePermission(canCreateUsers), createEmployee);
router.patch('/:id/leave-balance', protect, requirePermission(canManageUsers), updateLeaveBalance);

// Secure role assignment / forced password reset (improved authentication).
// assignRole does the fine-grained "can THIS caller grant THIS specific
// role/level" check itself (via canAssignRole, which needs the desired role
// from the body); requirePermission here is just the coarse "at least
// Admin/HR" gate so a plain employee/manager can't even reach the controller.
router.patch('/:id/role', protect, requirePermission(canCreateUsers), assignRole);
router.patch('/:id/force-password-reset', protect, requirePermission(canForcePasswordReset), forcePasswordReset);

module.exports = router;
