const express = require('express');
const {
  getAssets,
  createAsset,
  updateAsset
} = require('../controllers/assetController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getAssets);
router.post('/', protect, authorize('manager', 'admin'), createAsset);
router.put('/:id', protect, authorize('manager', 'admin'), updateAsset);

module.exports = router;
