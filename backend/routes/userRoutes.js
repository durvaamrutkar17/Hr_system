const express = require('express');
const { getUsers, createEmployee, updateCustomFields } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, authorize('manager', 'admin'), getUsers);
router.post('/', protect, authorize('manager', 'admin'), createEmployee);
router.put('/:id/custom-fields', protect, authorize('manager', 'admin'), updateCustomFields);

module.exports = router;
