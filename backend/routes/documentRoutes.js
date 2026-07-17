const express = require('express');
const multer = require('multer');
const path = require('path');
const {
  getDocuments,
  getDocumentVersions,
  uploadDocument,
  deleteDocument,
  addCompanyDocument,
  verifyDocument
} = require('../controllers/documentController');
const {
  getDocumentRequests,
  createDocumentRequest,
  updateDocumentRequest
} = require('../controllers/documentRequestController');
const { protect, authorize } = require('../middleware/auth');
const { requirePermission } = require('../middleware/permission');
const {
  canManageDocuments, canManageOfficialDocuments, canManageDocumentRequests
} = require('../permissions/permissionEngine');

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

// Document requests ("please issue me X" + approval workflow). Declared
// before the /:id routes below so the literal path "/requests" is never
// swallowed by the ":id" params.
router.get('/requests', protect, getDocumentRequests);
router.post('/requests', protect, createDocumentRequest);
router.patch('/requests/:id', protect, requirePermission(canManageDocumentRequests), updateDocumentRequest);

router.get('/:id/versions', protect, getDocumentVersions);
router.patch('/:id/verify', protect, requirePermission(canManageDocuments), verifyDocument);
router.delete('/:id', protect, deleteDocument);

// Old middleware (kept for reference): router.post('/company', protect, authorize('manager', 'admin'), upload.single('file'), addCompanyDocument);
// "HR owns official employee documents" - narrower than canManageDocuments
// (any reviewer): issuing an official document is now Admin/HR only.
router.post('/company', protect, requirePermission(canManageOfficialDocuments), upload.single('file'), addCompanyDocument);

module.exports = router;
