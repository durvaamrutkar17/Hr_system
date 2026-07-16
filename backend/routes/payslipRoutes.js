const express = require('express');
const {
  getPayslips,
  createPayslip,
  updatePayslip
} = require('../controllers/payslipController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canViewPayroll, canManagePayroll } = require('../permissions/permissionEngine');

const router = express.Router();

// Old middleware (kept for reference): router.get('/', protect, getPayslips);
router.get('/', protect, requirePermission(canViewPayroll), getPayslips);
// Old middleware (kept for reference): router.post('/', protect, authorize('manager', 'admin'), createPayslip);
router.post('/', protect, requirePermission(canManagePayroll), createPayslip);
// Old middleware (kept for reference): router.put('/:id', protect, authorize('manager', 'admin'), updatePayslip);
router.put('/:id', protect, requirePermission(canManagePayroll), updatePayslip);

module.exports = router;
