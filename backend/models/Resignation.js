const mongoose = require('mongoose');

const resignationSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  lastWorkingDay: {
    type: Date,
    required: [true, 'Proposed last working day is required']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required']
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'withdrawn', 'resigned'],
    default: 'pending'
  },
  clearance: {
    it: { type: Boolean, default: false },
    finance: { type: Boolean, default: false },
    hr: { type: Boolean, default: false }
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: Date,
  approvalRemarks: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

resignationSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('Resignation', resignationSchema);
