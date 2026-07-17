const mongoose = require('mongoose');

// An employee's request for HR/Admin to issue them an official document
// (e.g. "please issue my Experience Letter"). This is the "Document
// requests" + "Approval workflow" half of the Documents module redesign -
// approving a request doesn't create the file by itself, it just signals HR
// to go upload it (see documentController.js addCompanyDocument's
// `fulfillsRequestId` option, which links the uploaded Document back here
// and flips status to 'fulfilled').
const documentRequestSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  documentCategory: {
    type: String,
    enum: [
      'Recruitment', 'Joining', 'Identity', 'Payroll', 'Attendance', 'Leave',
      'Performance', 'Training', 'Assets', 'Compliance', 'Exit'
    ],
    required: [true, 'Document category is required']
  },
  documentType: {
    type: String,
    enum: [
      'Offer Letter', 'Appointment Letter', 'Form 16', 'Resume', 'Certificate', 'ID Proof', 'Address Proof', 'Other',
      'Salary Structure', 'Increment Letter', 'Promotion Letter', 'Experience Letter', 'Relieving Letter',
      'Payslips', 'NDA', 'Educational Certificates', 'PAN', 'Aadhaar', 'Passport', 'Medical Certificate', 'Bank Details'
    ],
    required: [true, 'Document type is required']
  },
  reason: {
    type: String,
    trim: true
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'fulfilled'],
    default: 'pending'
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  reviewedAt: Date,
  reviewRemarks: String,
  fulfillingDocumentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

documentRequestSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('DocumentRequest', documentRequestSchema);
