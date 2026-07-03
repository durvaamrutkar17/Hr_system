const express = require('express');
const {
  getExpenses,
  createExpense,
  updateExpense
} = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');

const router = express.Router();

router.get('/', protect, getExpenses);
router.post('/', protect, createExpense);
router.put('/:id', protect, authorize('manager', 'admin'), updateExpense);

module.exports = router;
