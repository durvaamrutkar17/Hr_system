const FlexHoursRequest = require('../models/FlexHoursRequest');
const Attendance = require('../models/Attendance');

const dayCapFor = (date) => (new Date(date).getDay() === 6 ? 5 : 9);

// Flex hours earned on days strictly before `beforeDate` (hours worked beyond that day's
// cap), minus hours already claimed by requests that haven't been rejected — pending
// requests hold their hours provisionally so the same banked time can't be spent twice.
const getAvailableFlexBalance = async (employeeId, beforeDate) => {
  const records = await Attendance.find({
    employeeId,
    date: { $lt: beforeDate },
    checkInTime: { $ne: null },
    checkOutTime: { $ne: null }
  });

  const earned = records.reduce(
    (sum, r) => sum + Math.max((r.hoursWorked || 0) - dayCapFor(r.date), 0),
    0
  );

  const claims = await FlexHoursRequest.find({ employeeId, status: { $ne: 'rejected' } });
  const claimed = claims.reduce((sum, r) => sum + r.hoursRequested, 0);

  return earned - claimed;
};

// @desc    Request to apply banked flex hours toward a shortfall day
// @route   POST /api/flex-hours
// @access  Private
exports.requestFlexHours = async (req, res) => {
  try {
    const { date, hoursRequested, reason } = req.body;

    if (!date || !hoursRequested || !reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Date, hours requested, and reason are required' });
    }

    const hours = Number(hoursRequested);
    if (!(hours > 0)) {
      return res.status(400).json({ success: false, message: 'Hours requested must be greater than 0' });
    }

    const requestDate = new Date(date);
    requestDate.setHours(0, 0, 0, 0);

    const balance = await getAvailableFlexBalance(req.user.id, requestDate);
    if (hours > balance) {
      return res.status(400).json({
        success: false,
        message: `Insufficient flex hours balance. Available: ${Math.max(balance, 0).toFixed(2)} hrs`
      });
    }

    const request = await FlexHoursRequest.create({
      employeeId: req.user.id,
      date: requestDate,
      hoursRequested: hours,
      reason: reason.trim()
    });

    res.status(201).json({ success: true, request });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get flex hours requests
// @route   GET /api/flex-hours
// @access  Private
exports.getFlexHoursRequests = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    } else if (req.user.role === 'employee') {
      query.employeeId = req.user.id;
    }

    const requests = await FlexHoursRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('employeeId', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName');

    res.status(200).json({ success: true, requests });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get the requesting employee's currently available flex hours balance
// @route   GET /api/flex-hours/balance
// @access  Private
exports.getFlexHoursBalance = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const balance = await getAvailableFlexBalance(req.user.id, today);
    res.status(200).json({ success: true, balance: Math.max(balance, 0) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve/Reject a flex hours request
// @route   PUT /api/flex-hours/:id
// @access  Private/Manager/Admin
exports.updateFlexHoursRequest = async (req, res) => {
  try {
    const { status, approvalRemarks } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be approved or rejected' });
    }

    const request = await FlexHoursRequest.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvalRemarks,
        approvedBy: req.user.id,
        approvalDate: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!request) {
      return res.status(404).json({ success: false, message: 'Flex hours request not found' });
    }

    res.status(200).json({ success: true, request });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
