const express = require('express');
const { getUsers, getUserById, createEmployee, updateLeaveBalance } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, authorize('manager', 'admin'), getUsers);
router.get('/:id', protect, authorize('manager', 'admin'), getUserById);
router.post('/', protect, authorize('manager', 'admin'), createEmployee);
router.patch('/:id/leave-balance', protect, authorize('manager', 'admin'), updateLeaveBalance);

module.exports = router;
