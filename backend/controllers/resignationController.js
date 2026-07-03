const Resignation = require('../models/Resignation');

// @desc    Submit a resignation request
// @route   POST /api/resignations
// @access  Private
exports.createResignation = async (req, res) => {
  try {
    const { lastWorkingDay, reason } = req.body;

    if (!lastWorkingDay || !reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Last working day and reason are required' });
    }

    const existing = await Resignation.findOne({
      employeeId: req.user.id,
      status: { $in: ['pending', 'approved'] }
    });

    if (existing) {
      return res.status(400).json({ success: false, message: 'You already have an active resignation request' });
    }

    const resignation = await Resignation.create({
      employeeId: req.user.id,
      lastWorkingDay,
      reason: reason.trim()
    });

    res.status(201).json({ success: true, resignation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get resignation requests
// @route   GET /api/resignations
// @access  Private
exports.getResignations = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    } else if (req.user.role === 'employee') {
      query.employeeId = req.user.id;
    }

    const resignations = await Resignation.find(query)
      .sort({ createdAt: -1 })
      .populate('employeeId', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName');

    res.status(200).json({ success: true, resignations });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve/reject a resignation or update its clearance checklist
// @route   PUT /api/resignations/:id
// @access  Private/Manager/Admin
exports.updateResignation = async (req, res) => {
  try {
    const { status, approvalRemarks, clearance } = req.body;
    const update = {};

    if (status) {
      update.status = status;
      update.approvedBy = req.user.id;
      update.approvalDate = Date.now();
    }
    if (approvalRemarks !== undefined) update.approvalRemarks = approvalRemarks;
    if (clearance) update.clearance = clearance;

    const resignation = await Resignation.findByIdAndUpdate(
      req.params.id,
      update,
      { new: true, runValidators: true }
    );

    if (!resignation) {
      return res.status(404).json({ success: false, message: 'Resignation not found' });
    }

    res.status(200).json({ success: true, resignation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Withdraw own pending resignation
// @route   PUT /api/resignations/:id/withdraw
// @access  Private
exports.withdrawResignation = async (req, res) => {
  try {
    const resignation = await Resignation.findOne({ _id: req.params.id, employeeId: req.user.id });

    if (!resignation) {
      return res.status(404).json({ success: false, message: 'Resignation not found' });
    }
    if (resignation.status !== 'pending') {
      return res.status(400).json({ success: false, message: 'Only a pending resignation can be withdrawn' });
    }

    resignation.status = 'withdrawn';
    await resignation.save();

    res.status(200).json({ success: true, resignation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
