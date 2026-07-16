const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  getDocuments,
  uploadDocument,
  deleteDocument,
  addCompanyDocument
} = require('../controllers/documentController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const { canManageDocuments } = require('../permissions/permissionEngine');

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

router.get('/', protect, getDocuments);
router.post('/upload', protect, upload.single('file'), uploadDocument);
router.delete('/:id', protect, deleteDocument);
// Old middleware (kept for reference): router.post('/company', protect, authorize('manager', 'admin'), upload.single('file'), addCompanyDocument);
router.post('/company', protect, requirePermission(canManageDocuments), upload.single('file'), addCompanyDocument);

module.exports = router;
