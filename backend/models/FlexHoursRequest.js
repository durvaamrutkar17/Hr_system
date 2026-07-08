const mongoose = require('mongoose');

const flexHoursRequestSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  hoursRequested: {
    type: Number,
    required: [true, 'Hours requested is required'],
    min: [0.01, 'Hours requested must be greater than 0']
  },
  reason: {
    type: String,
    required: [true, 'Reason is required']
  },
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

flexHoursRequestSchema.index({ employeeId: 1, date: -1 });

module.exports = mongoose.model('FlexHoursRequest', flexHoursRequestSchema);
