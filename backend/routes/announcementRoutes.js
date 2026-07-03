const express = require('express');
const {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
} = require('../controllers/announcementController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getAnnouncements);
router.post('/', protect, authorize('manager', 'admin'), createAnnouncement);
router.put('/:id', protect, authorize('manager', 'admin'), updateAnnouncement);
router.delete('/:id', protect, authorize('manager', 'admin'), deleteAnnouncement);

module.exports = router;
