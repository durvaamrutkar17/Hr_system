const express = require('express');
const {
  checkIn,
  checkOut,
  getAttendance,
  requestCorrection,
  getCorrectionRequests,
  updateCorrectionRequest
} = require('../controllers/attendanceController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canApproveAttendanceCorrection } = require('../permissions/permissionEngine');

const router = express.Router();

router.post('/check-in', protect, checkIn);
router.post('/check-out', protect, checkOut);
router.get('/', protect, getAttendance);
router.post('/correction', protect, requestCorrection);
router.get('/correction', protect, getCorrectionRequests);
// Old middleware (kept for reference): router.put('/correction/:id', protect, authorize('manager', 'admin'), updateCorrectionRequest);
router.put('/correction/:id', protect, requirePermission(canApproveAttendanceCorrection), updateCorrectionRequest);

module.exports = router;
