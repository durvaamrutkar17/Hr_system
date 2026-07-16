const express = require('express');
const {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday
} = require('../controllers/holidayController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canManageHolidays } = require('../permissions/permissionEngine');

const router = express.Router();

router.get('/', protect, getHolidays);
// Old middleware (kept for reference):
// router.post('/', protect, authorize('manager', 'admin'), createHoliday);
// router.put('/:id', protect, authorize('manager', 'admin'), updateHoliday);
// router.delete('/:id', protect, authorize('manager', 'admin'), deleteHoliday);
router.post('/', protect, requirePermission(canManageHolidays), createHoliday);
router.put('/:id', protect, requirePermission(canManageHolidays), updateHoliday);
router.delete('/:id', protect, requirePermission(canManageHolidays), deleteHoliday);

module.exports = router;
