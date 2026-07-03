const express = require('express');
const {
  getLeaves,
  getEmployeeLeaves,
  createLeave,
  updateLeave,
  deleteLeave
} = require('../controllers/leaveController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getLeaves);
router.get('/employee/:id', protect, getEmployeeLeaves);
router.post('/', protect, createLeave);
router.put('/:id', protect, authorize('manager', 'admin'), updateLeave);
router.delete('/:id', protect, deleteLeave);

module.exports = router;
