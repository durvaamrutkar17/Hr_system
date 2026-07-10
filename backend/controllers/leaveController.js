const Leave = require('../models/Leave');
const User = require('../models/User');

// @desc    Get all leaves
// @route   GET /api/leaves
// @access  Private
exports.getLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find()
      .sort({ createdAt: -1 })
      .populate('employeeId', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName');
    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get employee leaves
// @route   GET /api/leaves/employee/:id
// @access  Private
exports.getEmployeeLeaves = async (req, res) => {
  try {
    const leaves = await Leave.find({ employeeId: req.params.id })
      .sort({ createdAt: -1 })
      .populate('employeeId', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName');
    res.status(200).json({ success: true, leaves });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Create leave request
// @route   POST /api/leaves
// @access  Private
exports.createLeave = async (req, res) => {
  try {
    const { employeeId, leaveType, startDate, endDate, numberOfDays, reason } = req.body;

    const leave = await Leave.create({
      employeeId,
      leaveType,
      startDate,
      endDate,
      numberOfDays,
      reason
    });

    res.status(201).json({ success: true, leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve/Reject leave
// @route   PUT /api/leaves/:id
// @access  Private/Admin
exports.updateLeave = async (req, res) => {
  try {
    const { status, approvalRemarks } = req.body;
    const leave = await Leave.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvalRemarks,
        approvedBy: req.user.id,
        approvalDate: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    // Update leave balance if approved
    if (status === 'approved') {
      const user = await User.findById(leave.employeeId);
      if (leave.leaveType === 'Casual') {
        user.casualLeaveBalance -= leave.numberOfDays;
      } else if (leave.leaveType === 'Sick') {
        user.sickLeaveBalance -= leave.numberOfDays;
      } else if (leave.leaveType === 'Earned') {
        user.earnedLeaveBalance -= leave.numberOfDays;
      }
      await user.save();
    }

    res.status(200).json({ success: true, leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete leave
// @route   DELETE /api/leaves/:id
// @access  Private
exports.deleteLeave = async (req, res) => {
  try {
    const leave = await Leave.findByIdAndDelete(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }
    res.status(200).json({ success: true, message: 'Leave deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
