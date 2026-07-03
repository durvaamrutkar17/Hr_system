const express = require('express');
const {
  createResignation,
  getResignations,
  updateResignation,
  withdrawResignation
} = require('../controllers/resignationController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.post('/', protect, createResignation);
router.get('/', protect, getResignations);
router.put('/:id', protect, authorize('manager', 'admin'), updateResignation);
router.put('/:id/withdraw', protect, withdrawResignation);

module.exports = router;
