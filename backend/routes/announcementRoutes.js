const express = require('express');
const {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canManageAnnouncements } = require('../permissions/permissionEngine');

const router = express.Router();

router.get('/', protect, getAnnouncements);
// Old middleware (kept for reference):
// router.post('/', protect, authorize('manager', 'admin'), createAnnouncement);
// router.put('/:id', protect, authorize('manager', 'admin'), updateAnnouncement);
// router.delete('/:id', protect, authorize('manager', 'admin'), deleteAnnouncement);
router.post('/', protect, requirePermission(canManageAnnouncements), createAnnouncement);
router.put('/:id', protect, requirePermission(canManageAnnouncements), updateAnnouncement);
router.delete('/:id', protect, requirePermission(canManageAnnouncements), deleteAnnouncement);

module.exports = router;
