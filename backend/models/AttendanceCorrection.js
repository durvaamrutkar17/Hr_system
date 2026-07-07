const mongoose = require('mongoose');

const attendanceCorrectionSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required']
  },
  requestedCheckInTime: Date,
  requestedCheckOutTime: Date,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
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
  }
});

attendanceCorrectionSchema.index({ employeeId: 1, date: -1 });

module.exports = mongoose.model('AttendanceCorrection', attendanceCorrectionSchema);
