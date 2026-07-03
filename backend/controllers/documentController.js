const fs = require('fs');
const path = require('path');
const Document = require('../models/Document');

// @desc    Get documents
// @route   GET /api/documents
// @access  Private
exports.getDocuments = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const query = {};

    if (employeeId) query.employeeId = employeeId;

    const documents = await Document.find(query)
      .sort({ uploadedDate: -1 })
      .populate('employeeId', 'firstName lastName email');

    res.status(200).json({ success: true, documents });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Upload a personal document
// @route   POST /api/documents/upload
// @access  Private
exports.uploadDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { fileName, documentType } = req.body;

    const document = await Document.create({
      employeeId: req.user.id,
      documentType: documentType || 'Other',
      category: 'personal',
      fileName: fileName?.trim() || req.file.originalname,
      fileUrl: `/uploads/${req.file.filename}`
    });

    res.status(201).json({ success: true, document });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete a document
// @route   DELETE /api/documents/:id
// @access  Private (owner) or Manager/Admin
exports.deleteDocument = async (req, res) => {
  try {
    const document = await Document.findById(req.params.id);

    if (!document) {
      return res.status(404).json({ success: false, message: 'Document not found' });
    }

    const isOwner = document.employeeId.toString() === req.user.id;
    const isReviewer = req.user.role === 'manager' || req.user.role === 'admin';

    if (!isOwner && !isReviewer) {
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

// @desc    Issue a company letter/document to an employee
// @route   POST /api/documents/company
// @access  Private/Manager/Admin
exports.addCompanyDocument = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }

    const { employeeId, fileName, documentType, uploadedDate } = req.body;

    if (!employeeId || !fileName || !documentType) {
      return res.status(400).json({ success: false, message: 'employeeId, fileName and documentType are required' });
    }

    const document = await Document.create({
      employeeId,
      documentType,
      category: 'company',
      fileName: fileName.trim(),
      fileUrl: `/uploads/${req.file.filename}`,
      uploadedDate: uploadedDate || Date.now()
    });

    res.status(201).json({ success: true, document });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
