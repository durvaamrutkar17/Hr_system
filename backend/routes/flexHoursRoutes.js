const express = require('express');
const {
  requestFlexHours,
  getFlexHoursRequests,
  getFlexHoursBalance,
  updateFlexHoursRequest
} = require('../controllers/flexHoursController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, requestFlexHours);
router.get('/', protect, getFlexHoursRequests);
router.get('/balance', protect, getFlexHoursBalance);
router.put('/:id', protect, authorize('manager', 'admin'), updateFlexHoursRequest);

module.exports = router;
