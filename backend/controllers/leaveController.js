const Leave = require('../models/Leave');
const User = require('../models/User');

// Mirrors frontend/src/utils/leavePolicy.js — kept in sync manually since this
// is the one place balance deduction needs the same probation/quota rules the
// employee sees applied to their attendance (leave taken during probation, or
// beyond the monthly paid quota, is unpaid/absent and shouldn't cost balance).
const PROBATION_MONTHS = 6;
const PAID_LEAVE_DAYS_PER_MONTH = 2;

const isOnProbation = (dateOfJoining, referenceDate) => {
  if (!dateOfJoining) return false;
  const cutoff = new Date(dateOfJoining);
  cutoff.setMonth(cutoff.getMonth() + PROBATION_MONTHS);
  return new Date(referenceDate) < cutoff;
};

// How many of this (now-approved) leave's days are actually paid, considering
// probation and the shared monthly paid-day quota across all leave types —
// only the paid portion should be deducted from the employee's balance.
const computePaidDaysForLeave = async (user, leave) => {
  if (isOnProbation(user.dateOfJoining, leave.startDate)) return 0;

  const month = new Date(leave.startDate).getMonth() + 1;
  const year = new Date(leave.startDate).getFullYear();

  const approvedThisMonth = (await Leave.find({ employeeId: leave.employeeId, status: 'approved' }))
    .filter((l) => {
      const start = new Date(l.startDate);
      return start.getMonth() + 1 === month && start.getFullYear() === year;
    })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  let paidDaysUsed = 0;
  for (const l of approvedThisMonth) {
    const onProbation = isOnProbation(user.dateOfJoining, l.startDate);
    const paidDays = onProbation
      ? 0
      : Math.min(Math.max(PAID_LEAVE_DAYS_PER_MONTH - paidDaysUsed, 0), l.numberOfDays || 0);
    if (!onProbation) paidDaysUsed += paidDays;

    if (String(l._id) === String(leave._id)) return paidDays;
  }
  return 0;
};

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

    // Deduct leave balance if approved — only for days that are actually paid;
    // days that are unpaid (on probation, or past the monthly paid quota) are
    // marked absent instead and shouldn't consume the employee's balance.
    if (status === 'approved') {
      const user = await User.findById(leave.employeeId);
      const paidDays = await computePaidDaysForLeave(user, leave);

      if (paidDays > 0) {
        if (leave.leaveType === 'Casual') {
          user.casualLeaveBalance -= paidDays;
        } else if (leave.leaveType === 'Sick') {
          user.sickLeaveBalance -= paidDays;
        } else if (leave.leaveType === 'Earned') {
          user.earnedLeaveBalance -= paidDays;
        }
        await user.save();
      }
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
