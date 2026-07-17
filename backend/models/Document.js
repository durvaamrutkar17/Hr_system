const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  // Old enum (kept, all 8 values still valid): ['Offer Letter', 'Appointment
  // Letter', 'Form 16', 'Resume', 'Certificate', 'ID Proof', 'Address Proof', 'Other']
  // Extended with the specific document types from the redesigned Documents
  // module. Nothing removed, so existing rows keep validating.
  documentType: {
    type: String,
    enum: [
      // original values
      'Offer Letter', 'Appointment Letter', 'Form 16', 'Resume', 'Certificate', 'ID Proof', 'Address Proof', 'Other',
      // added by the Documents module redesign
      'Salary Structure', 'Increment Letter', 'Promotion Letter', 'Experience Letter', 'Relieving Letter',
      'Payslips', 'NDA', 'Educational Certificates', 'PAN', 'Aadhaar', 'Passport', 'Medical Certificate', 'Bank Details'
    ],
    required: [true, 'Document type is required']
  },
  // Ownership marker: 'company' = an official document HR/Admin issued to
  // the employee, 'personal' = the employee's own upload. This field already
  // existed and already implements "HR owns official documents, employees
  // upload only personal documents" - kept as-is (renaming it would break
  // every existing read of `.category` across the frontend).
  category: {
    type: String,
    enum: ['company', 'personal'],
    default: 'personal'
  },
  // New: the broader lifecycle/functional category from the Documents
  // module redesign - independent of `category` above (that's ownership,
  // this is classification). Optional so any pre-existing rows without it
  // still validate.
  documentCategory: {
    type: String,
    enum: [
      'Recruitment', 'Joining', 'Identity', 'Payroll', 'Attendance', 'Leave',
      'Performance', 'Training', 'Assets', 'Compliance', 'Exit'
    ]
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
  // New: when/why a verification decision was made (verifiedBy/verificationStatus
  // already existed but nothing ever actually set them - see documentController.js verifyDocument).
  verifiedAt: Date,
  verificationRemarks: String,
  // New: who can see this document besides its owner and reviewers (who can
  // always see everything, same as the rest of the app's "any manager/admin
  // sees everyone" pattern). 'private' = owner + reviewers only (default -
  // matches today's de-facto behavior for personal docs). 'managers' =
  // reserved for future team-scoped visibility. 'company' = every employee,
  // for things like a shared NDA template or policy document.
  visibility: {
    type: String,
    enum: ['private', 'managers', 'company'],
    default: 'private'
  },
  // New: version history. `versionGroupId` is shared by every version of the
  // "same" document (defaults to the first version's own _id - see the
  // pre-save hook below). `previousVersionId` links to the version this one
  // replaced. Old versions are never deleted or mutated, just marked
  // isLatest:false, so the full history stays intact and auditable.
  versionGroupId: {
    type: mongoose.Schema.Types.ObjectId
  },
  version: {
    type: Number,
    default: 1
  },
  isLatest: {
    type: Boolean,
    default: true
  },
  previousVersionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Document'
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

documentSchema.index({ employeeId: 1, isLatest: 1 });
documentSchema.index({ versionGroupId: 1, version: -1 });

// A brand-new document (not an explicit new version of an existing one)
// becomes the root of its own version group.
documentSchema.pre('save', function (next) {
  if (this.isNew && !this.versionGroupId) {
    this.versionGroupId = this._id;
  }
  next();
});

module.exports = mongoose.model('Document', documentSchema);
