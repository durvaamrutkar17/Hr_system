const express = require('express');
const {
  getHolidays,
  createHoliday,
  updateHoliday,
  deleteHoliday
} = require('../controllers/holidayController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getHolidays);
router.post('/', protect, authorize('manager', 'admin'), createHoliday);
router.put('/:id', protect, authorize('manager', 'admin'), updateHoliday);
router.delete('/:id', protect, authorize('manager', 'admin'), deleteHoliday);

module.exports = router;
