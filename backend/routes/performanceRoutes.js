const express = require('express');
const { getEmployeePerformance, createPerformanceReview } = require('../controllers/performanceController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canViewPerformance, canManagePerformance } = require('../permissions/permissionEngine');

const router = express.Router();

router.get('/employee/:id', protect, requirePermission(canViewPerformance, { paramKey: 'id' }), getEmployeePerformance);
router.post('/', protect, requirePermission(canManagePerformance), createPerformanceReview);

module.exports = router;
