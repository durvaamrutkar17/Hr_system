const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');
const DocumentRequest = require('../models/DocumentRequest');
const { isReviewer, canManageOfficialDocuments } = require('../permissions/permissionEngine');

// @desc    Get documents
// @route   GET /api/documents
// @access  Private
exports.getDocuments = async (req, res) => {
  try {
    // Old query (kept for reference): completely unscoped - any authenticated
    // user could see any employee's documents by passing their employeeId,
    // and every version of a document (not just the latest) came back mixed
    // together.
    // const { employeeId } = req.query;
    // const query = {};
    // if (employeeId) query.employeeId = employeeId;

    const { employeeId, documentCategory, documentType, verificationStatus } = req.query;

    // Visibility: a reviewer (manager/admin/HR) still sees everyone's
    // documents, same as the rest of the app. A plain employee can only see
    // their own documents (any visibility) plus anyone's 'company'-wide
    // documents - passing someone else's employeeId no longer bypasses this.
    const query = {};
    if (isReviewer(req.user)) {
      if (employeeId) query.employeeId = employeeId;
    } else {
      query.$or = [{ employeeId: req.user.id }, { visibility: 'company' }];
    }

    if (documentCategory) query.documentCategory = documentCategory;
    if (documentType) query.documentType = documentType;
    if (verificationStatus) query.verificationStatus = verificationStatus;
    // Only the latest version of each document shows up in the main list -
    // use GET /api/documents/:id/versions for the full history of one document.
    query.isLatest = true;

    const documents = await Document.find(query)
      .sort({ uploadedDate: -1 })
      .populate('employeeId', 'firstName lastName email')
      .populate('verifiedBy', 'firstName lastName');

    res.status(200).json({ success: true, documents });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get the full version history of a document
// @route   GET /api/documents/:id/versions
// @access  Private (owner or reviewer)
exports.getDocumentVersions = async (req, res) => {
  try {
    const doc = await Document.findById(req.params.id);
    if (!doc) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const isOwner = doc.employeeId.toString() === req.user.id;
    if (!isOwner && !isReviewer(req.user) && doc.visibility !== 'company') {
      return res.status(403).json({ success: false, message: 'Not authorized to view this document' });
    }

    const versions = await Document.find({ versionGroupId: doc.versionGroupId })
      .sort({ version: -1 })
      .populate('verifiedBy', 'firstName lastName');

    res.status(200).json({ success: true, versions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Upload a personal document (optionally as a new version of an
//          existing personal document the caller owns)
// @route   POST /api/documents/upload
// @access  Private
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Old body (kept for reference): only fileName/documentType were read;
    // no documentCategory, expiryDate, or version-of-an-existing-document support.
    // const { fileName, documentType } = req.body;
    const { fileName, documentType, documentCategory, expiryDate, versionOf } = req.body;

    const versioning = await buildVersioningFields({
      versionOf,
      requesterId: req.user.id,
      requireOwner: true
    });
    if (versioning.error) {
      return res.status(versioning.status).json({ success: false, message: versioning.error });
    }

    const document = await Document.create({
      employeeId: req.user.id,
      documentType: documentType || 'Other',
      documentCategory: documentCategory || undefined,
      category: 'personal',
      visibility: 'private',
      expiryDate: expiryDate || undefined,
      fileName: fileName?.trim() || req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`,
      ...versioning.fields
    });

    if (versioning.previousDoc) {
      versioning.previousDoc.isLatest = false;
      await versioning.previousDoc.save();
    }

    res.status(201).json({ success: true, document });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private (owner, personal docs only) or reviewer (personal docs) /
//          Admin+HR (official/company docs)
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    // Old check (kept for reference) - an employee could delete an official
    // ('company') document HR had issued them, since they're its `employeeId`
    // owner: "Employees cannot edit HR documents" closes that gap below.
    // const isOwner = document.employeeId.toString() === req.user.id;
    // const isReviewer = req.user.role === 'manager' || req.user.role === 'admin';
    // if (!isOwner && !isReviewer) { ... }
    const isOwner = document.employeeId.toString() === req.user.id;

    if (document.category === 'company') {
      if (!canManageOfficialDocuments(req.user)) {
        return res.status(403).json({ success: false, message: 'Only HR/Admin can remove an official document' });
      }
    } else if (!isOwner && !isReviewer(req.user)) {
      return res.status(403).json({ success: false, message: 'Not authorized to delete this document' });
    }

    const filePath = path.join(__dirname, '..', document.fileUrl);
    fs.unlink(filePath, (err) => {
      if (err) console.error('Failed to delete file from disk:', err.message);
    });

    await document.deleteOne();

    res.status(200).json({ success: true, message: 'Document deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Issue an official document to an employee (optionally as a new
//          version of an existing official document, and optionally
//          fulfilling a pending document request)
// @route   POST /api/documents/company
// @access  Private/Admin/HR (canManageOfficialDocuments)
exports.addCompanyDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    // Old body (kept for reference): no documentCategory, expiryDate,
    // visibility, versionOf, or fulfillsRequestId support.
    // const { employeeId, fileName, documentType, uploadedDate } = req.body;
    const {
      employeeId, fileName, documentType, uploadedDate,
      documentCategory, expiryDate, visibility, versionOf, fulfillsRequestId
    } = req.body;

    if (!employeeId || !fileName || !documentType) {
      return res.status(400).json({ success: false, message: 'employeeId, fileName and documentType are required' });
    }

    const versioning = await buildVersioningFields({ versionOf, requesterId: null, requireOwner: false });
    if (versioning.error) {
      return res.status(versioning.status).json({ success: false, message: versioning.error });
    }

    const document = await Document.create({
      employeeId,
      documentType,
      documentCategory: documentCategory || undefined,
      category: 'company',
      visibility: ['private', 'managers', 'company'].includes(visibility) ? visibility : 'private',
      expiryDate: expiryDate || undefined,
      fileName: fileName.trim(),
      fileUrl: `/uploads/${req.file.filename}`,
      uploadedDate: uploadedDate || Date.now(),
      ...versioning.fields
    });

    if (versioning.previousDoc) {
      versioning.previousDoc.isLatest = false;
      await versioning.previousDoc.save();
    }

    if (fulfillsRequestId) {
      const request = await DocumentRequest.findById(fulfillsRequestId);
      if (request && request.status !== 'fulfilled') {
        request.status = 'fulfilled';
        request.fulfillingDocumentId = document._id;
        request.reviewedBy = req.user.id;
        request.reviewedAt = new Date();
        await request.save();
      }
    }

    res.status(201).json({ success: true, document });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Verify (or reject) a document's authenticity
// @route   PATCH /api/documents/:id/verify
// @access  Private/Manager/Admin (canManageDocuments)
exports.verifyDocument = async (req, res) => {
  try {
    const { verificationStatus, verificationRemarks } = req.body;
    if (!['verified', 'rejected', 'pending'].includes(verificationStatus)) {
      return res.status(400).json({ success: false, message: 'Invalid verificationStatus' });
    }

    const document = await Document.findById(req.params.id);
    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    document.verificationStatus = verificationStatus;
    document.verificationRemarks = verificationRemarks;
    document.verifiedBy = req.user.id;
    document.verifiedAt = new Date();
    await document.save();

    const populated = await document.populate('verifiedBy', 'firstName lastName');

    res.status(200).json({ success: true, document: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// Shared helper: resolves the version-history fields for a new upload when
// `versionOf` (an existing document's id) is provided. Returns
// { fields, previousDoc } to merge into Document.create(), or { error, status }.
async function buildVersioningFields({ versionOf, requesterId, requireOwner }) {
  if (!versionOf) return { fields: {} };

  const previousDoc = await Document.findById(versionOf);
  if (!previousDoc) {
    return { error: 'Original document not found', status: 404 };
  }
  if (requireOwner && previousDoc.employeeId.toString() !== requesterId) {
    return { error: 'You can only version your own documents', status: 403 };
  }

  const latestForGroup = await Document.findOne({ versionGroupId: previousDoc.versionGroupId }).sort({ version: -1 });

  return {
    fields: {
      versionGroupId: previousDoc.versionGroupId,
      version: (latestForGroup?.version || previousDoc.version || 1) + 1,
      previousVersionId: previousDoc._id
    },
    previousDoc: latestForGroup || previousDoc
  };
}

