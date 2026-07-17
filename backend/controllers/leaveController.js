const Leave = require('../models/Leave');
const User = require('../models/User');
const { buildApprovalChain } = require('../utils/leaveApprovalChain');
const { isAdmin } = require('../permissions/permissionEngine');

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

// Extracted from the old updateLeave (same logic, unchanged) so both the
// fallback single-step path and the new hierarchy chain's final-stage
// approval can call it identically. Must run AFTER `leave.status` has
// already been persisted as 'approved', since computePaidDaysForLeave reads
// this employee's approved leaves back from the database (including this one).
const applyLeaveBalanceDeduction = async (leave) => {
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

    // Hierarchy approval (Leave module upgrade): attach the sequential
    // Team Lead -> Manager -> Department Head -> HR chain for whoever this
    // leave belongs to. An empty chain means this employee hasn't been
    // placed in the org hierarchy yet, so approvalChain is left at its
    // schema default ([]) and updateLeave falls back to the original
    // single-step "any reviewer approves" flow - nothing breaks for
    // accounts that predate this feature.
    const approvalChain = await buildApprovalChain(employeeId);
    if (approvalChain.length > 0) {
      leave.approvalChain = approvalChain;
      await leave.save();
    }

    res.status(201).json({ success: true, leave });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve/Reject leave (single-step, or one stage of the hierarchy
//          approval chain - see utils/leaveApprovalChain.js)
// @route   PUT /api/leaves/:id
// @access  Private/Manager/Admin (canApproveLeave, checked at the route -
//          that's the coarse "some kind of reviewer" gate; this controller
//          additionally enforces which reviewer, in what order, below)
exports.updateLeave = async (req, res) => {
  try {
    const { status, approvalRemarks } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be approved or rejected' });
    }

    const leave = await Leave.findById(req.params.id);
    if (!leave) {
      return res.status(404).json({ success: false, message: 'Leave not found' });
    }

    // Old logic (kept for reference - single-step approve/reject, no
    // per-stage authorization at all beyond the route's canApproveLeave gate):
    // const leave = await Leave.findByIdAndUpdate(req.params.id, { status, approvalRemarks, approvedBy: req.user.id, approvalDate: Date.now() }, { new: true, runValidators: true });
    // if (!leave) return res.status(404).json({ success: false, message: 'Leave not found' });
    // if (status === 'approved') {
    //   const user = await User.findById(leave.employeeId);
    //   const paidDays = await computePaidDaysForLeave(user, leave);
    //   if (paidDays > 0) { ...deduct from user.casualLeaveBalance/sickLeaveBalance/earnedLeaveBalance...; await user.save(); }
    // }
    // That exact logic is preserved verbatim below (via applyLeaveBalanceDeduction)
    // as the fallback path for any leave with no approvalChain attached.

    if (!leave.approvalChain || leave.approvalChain.length === 0) {
      leave.status = status;
      leave.approvalRemarks = approvalRemarks;
      leave.approvedBy = req.user.id;
      leave.approvalDate = Date.now();
      await leave.save();

      if (status === 'approved') {
        await applyLeaveBalanceDeduction(leave);
      }

      return res.status(200).json({ success: true, leave });
    }

    // Hierarchy approval: act on whichever stage is currently pending, in
    // order. Team Lead/Manager/Department Head stages require the specific
    // person the chain identified (or an Admin/CEO override); the HR stage
    // is role-based - any Admin/HR account can act on it.
    const stageIndex = leave.approvalChain.findIndex((s) => s.status === 'pending');
    if (stageIndex === -1) {
      return res.status(400).json({ success: false, message: 'This leave request has already completed its approval chain' });
    }
    const stage = leave.approvalChain[stageIndex];

    const authorized = stage.level === 'HR'
      ? (isAdmin(req.user) || req.user.organizationLevel === 'HR')
      : (String(req.user.id) === String(stage.approverId) || isAdmin(req.user));

    if (!authorized) {
      return res.status(403).json({
        success: false,
        message: `Not authorized - this request is currently awaiting ${stage.level} approval`
      });
    }

    stage.status = status;
    stage.actedBy = req.user.id;
    stage.actedAt = new Date();
    stage.remarks = approvalRemarks;

    if (status === 'rejected') {
      // One rejection anywhere in the chain ends the whole request - the
      // remaining un-acted stages never happen.
      for (let i = stageIndex + 1; i < leave.approvalChain.length; i++) {
        leave.approvalChain[i].status = 'skipped';
      }
      leave.status = 'rejected';
      leave.approvedBy = req.user.id;
      leave.approvalDate = new Date();
      leave.approvalRemarks = approvalRemarks;
      await leave.save();
      return res.status(200).json({ success: true, leave });
    }

    const isFinalStage = stageIndex === leave.approvalChain.length - 1;
    if (isFinalStage) {
      // HR final approval - the whole request is now approved.
      leave.status = 'approved';
      leave.approvedBy = req.user.id;
      leave.approvalDate = new Date();
      leave.approvalRemarks = approvalRemarks;
    }
    // else: overall status stays 'pending' - the next stage in the array is
    // now the pending one, nothing further to update for it.
    await leave.save();

    if (isFinalStage) {
      await applyLeaveBalanceDeduction(leave);
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
