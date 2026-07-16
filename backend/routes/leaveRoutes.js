const express = require('express');
const {
  getLeaves,
  getEmployeeLeaves,
  createLeave,
  updateLeave,
  deleteLeave
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canApproveLeave } = require('../permissions/permissionEngine');

const router = express.Router();

router.get('/', protect, getLeaves);
router.get('/employee/:id', protect, getEmployeeLeaves);
router.post('/', protect, createLeave);
// Old middleware (kept for reference): router.put('/:id', protect, authorize('manager', 'admin'), updateLeave);
router.put('/:id', protect, requirePermission(canApproveLeave), updateLeave);
router.delete('/:id', protect, deleteLeave);

module.exports = router;
