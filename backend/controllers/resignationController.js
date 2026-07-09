const Resignation = require('../models/Resignation');
const Asset = require('../models/Asset');
const User = require('../models/User');

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

    const existing = await Resignation.findById(req.params.id);
    if (!existing) {
      return res.status(404).json({ success: false, message: 'Resignation not found' });
    }

    if (status === 'resigned') {
      if (existing.status !== 'approved') {
        return res.status(400).json({ success: false, message: 'Only an approved resignation can be marked as resigned' });
      }

      const mergedClearance = {
        it: existing.clearance?.it,
        finance: existing.clearance?.finance,
        hr: existing.clearance?.hr,
        ...(clearance || {})
      };
      if (!mergedClearance.it || !mergedClearance.finance || !mergedClearance.hr) {
        return res.status(400).json({ success: false, message: 'Complete the IT, Finance and HR clearance checklist before marking as resigned' });
      }

      const activeAssets = await Asset.countDocuments({ employeeId: existing.employeeId, status: 'active' });
      if (activeAssets > 0) {
        return res.status(400).json({
          success: false,
          message: `This employee still has ${activeAssets} active asset${activeAssets > 1 ? 's' : ''} assigned — mark them returned first`
        });
      }
    }

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

    if (status === 'resigned') {
      await User.findByIdAndUpdate(resignation.employeeId, { status: 'resigned' });
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
