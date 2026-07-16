const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  getExpenses,
  createExpense,
  updateExpense
} = require('../controllers/expenseController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canApproveExpense } = require('../permissions/permissionEngine');

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.get('/', protect, getExpenses);
router.post('/', protect, upload.array('receipts', 5), createExpense);
// Old middleware (kept for reference): router.put('/:id', protect, authorize('manager', 'admin'), updateExpense);
router.put('/:id', protect, requirePermission(canApproveExpense), updateExpense);

module.exports = router;
