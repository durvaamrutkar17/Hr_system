const express = require('express');
const {
  requestFlexHours,
  getFlexHoursRequests,
  getFlexHoursBalance,
  updateFlexHoursRequest
} = require('../controllers/flexHoursController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canApproveFlexHours } = require('../permissions/permissionEngine');

const router = express.Router();

router.post('/', protect, requestFlexHours);
router.get('/', protect, getFlexHoursRequests);
router.get('/balance', protect, getFlexHoursBalance);
// Old middleware (kept for reference): router.put('/:id', protect, authorize('manager', 'admin'), updateFlexHoursRequest);
router.put('/:id', protect, requirePermission(canApproveFlexHours), updateFlexHoursRequest);

module.exports = router;
