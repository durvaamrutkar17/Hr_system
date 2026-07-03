const express = require('express');
const { getUsers, createEmployee } = require('../controllers/userController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, authorize('manager', 'admin'), getUsers);
router.post('/', protect, authorize('manager', 'admin'), createEmployee);

module.exports = router;
