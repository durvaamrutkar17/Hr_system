const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentType: {
    type: String,
    enum: ['Offer Letter', 'Appointment Letter', 'Form 16', 'Resume', 'Certificate', 'ID Proof', 'Address Proof', 'Other'],
    required: [true, 'Document type is required']
  },
  category: {
    type: String,
    enum: ['company', 'personal'],
    default: 'personal'
  },
  fileName: {
    type: String,
    required: [true, 'File name is required']
  },
  fileUrl: {
    type: String,
    required: [true, 'File URL is required']
  },
  uploadedDate: {
    type: Date,
    default: Date.now
  },
  expiryDate: Date,
  remarks: String,
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending'
  },
  verifiedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Document', documentSchema);
