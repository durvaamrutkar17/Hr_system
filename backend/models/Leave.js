const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  leaveType: {
    type: String,
    enum: ['Casual', 'Sick', 'Earned', 'Unpaid'],
    required: [true, 'Leave type is required']
  },
  startDate: {
    type: Date,
    required: [true, 'Start date is required']
  },
  endDate: {
    type: Date,
    required: [true, 'End date is required']
  },
  numberOfDays: {
    type: Number,
    required: [true, 'Number of days is required']
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
  // Leave module upgrade: hierarchy approval. Populated when the request is
  // created (see controllers/leaveController.js createLeave, using
  // utils/leaveApprovalChain.js) with the sequential Team Lead -> Manager ->
  // Department Head -> HR stages that actually exist above this employee in
  // the org hierarchy. `status`/`approvedBy`/`approvalDate`/`approvalRemarks`
  // above stay as the overall/final result either way - they're unchanged in
  // meaning, just now set once the whole chain finishes instead of in one step.
  // An empty array means no hierarchy was configured for this employee when
  // the request was made, so updateLeave falls back to the original
  // single-step "any reviewer approves" behavior.
  approvalChain: {
    type: [{
      level: {
        type: String,
        enum: ['Team Lead', 'Manager', 'Department Head', 'HR'],
        required: true
      },
      // null for the HR stage - HR approval is role-based (any Admin/HR
      // account), not tied to one specific person.
      approverId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'skipped'],
        default: 'pending'
      },
      actedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      },
      actedAt: Date,
      remarks: String
    }],
    default: []
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

leaveSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('Leave', leaveSchema);
