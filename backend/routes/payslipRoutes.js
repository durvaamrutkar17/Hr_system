const express = require('express');
const {
  getPayslips,
  createPayslip,
  updatePayslip
} = require('../controllers/payslipController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getPayslips);
router.post('/', protect, authorize('manager', 'admin'), createPayslip);
router.put('/:id', protect, authorize('manager', 'admin'), updatePayslip);

module.exports = router;
