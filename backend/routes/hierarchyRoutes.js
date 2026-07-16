const express = require('express');
const {
  getDirectReports,
  getCompleteHierarchy,
  getReportingChain
} = require('../controllers/hierarchyController');
const { protect } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canViewHierarchy, canManageUsers } = require('../permissions/permissionEngine');

const router = express.Router();

// Self or reviewer (see permissionEngine.js) - anyone can look up their own
// direct reports / reporting chain; viewing someone else's requires manager/admin.
router.get('/direct-reports/:id', protect, requirePermission(canViewHierarchy, { paramKey: 'id' }), getDirectReports);
router.get('/reporting-chain/:id', protect, requirePermission(canViewHierarchy, { paramKey: 'id' }), getReportingChain);

// Reviewer-only (same gate as GET /api/users) - :id is optional; omit it to
// get the whole company tree, or pass an employee id to get their subtree.
router.get('/complete/:id?', protect, requirePermission(canManageUsers), getCompleteHierarchy);

module.exports = router;
