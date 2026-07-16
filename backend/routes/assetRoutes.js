const express = require('express');
const {
  getAssets,
  createAsset,
  updateAsset
} = require('../controllers/assetController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canManageAssets } = require('../permissions/permissionEngine');

const router = express.Router();

router.get('/', protect, getAssets);
// Old middleware (kept for reference):
// router.post('/', protect, authorize('manager', 'admin'), createAsset);
// router.put('/:id', protect, authorize('manager', 'admin'), updateAsset);
router.post('/', protect, requirePermission(canManageAssets), createAsset);
router.put('/:id', protect, requirePermission(canManageAssets), updateAsset);

module.exports = router;
