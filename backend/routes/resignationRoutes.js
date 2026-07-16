const express = require('express');
const {
  createResignation,
  getResignations,
  updateResignation,
  withdrawResignation
} = require('../controllers/resignationController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canApproveResignation } = require('../permissions/permissionEngine');

const router = express.Router();

router.post('/', protect, createResignation);
router.get('/', protect, getResignations);
// Old middleware (kept for reference): router.put('/:id', protect, authorize('manager', 'admin'), updateResignation);
router.put('/:id', protect, requirePermission(canApproveResignation), updateResignation);
router.put('/:id/withdraw', protect, withdrawResignation);

module.exports = router;
