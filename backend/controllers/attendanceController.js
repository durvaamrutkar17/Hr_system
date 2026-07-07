const Attendance = require('../models/Attendance');
const AttendanceCorrection = require('../models/AttendanceCorrection');

// @desc    Check in
// @route   POST /api/attendance/check-in
// @access  Private
exports.checkIn = async (req, res) => {
  try {
    const { workMode, reason } = req.body;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const existingAttendance = await Attendance.findOne({
      employeeId: req.user.id,
      date: today
    });

    if (existingAttendance) {
      // Records created before the sessions array existed only have the top-level fields —
      // backfill so the session history stays consistent going forward
      if (existingAttendance.sessions.length === 0 && existingAttendance.checkInTime) {
        existingAttendance.sessions.push({
          checkInTime: existingAttendance.checkInTime,
          checkOutTime: existingAttendance.checkOutTime,
          workMode: existingAttendance.workMode
        });
      }

      const lastSession = existingAttendance.sessions[existingAttendance.sessions.length - 1];

      if (lastSession && !lastSession.checkOutTime) {
        // Already checked in and not checked out, return the existing record
        return res.status(200).json({ success: true, attendance: existingAttendance, message: 'Already checked in. Waiting for check out.' });
      }

      // Already checked out at least once today (e.g. took a half day) — this is a re-check-in,
      // such as coming back to work at night, and requires a reason
      if (!reason || !reason.trim()) {
        return res.status(400).json({ success: false, message: 'Please provide a reason for checking in again today' });
      }

      existingAttendance.sessions.push({ checkInTime: new Date(), reason: reason.trim(), workMode });
      existingAttendance.checkOutTime = undefined;
      // The day-level workMode reflects the most recently started session, since each
      // check-in can use a different mode (e.g. WFO in the morning, WFH that night)
      if (workMode) existingAttendance.workMode = workMode;
      await existingAttendance.save();

      return res.status(201).json({ success: true, attendance: existingAttendance, message: 'Checked in again' });
    }

    const now = new Date();
    const attendance = await Attendance.create({
      employeeId: req.user.id,
      date: today,
      checkInTime: now,
      workMode,
      status: 'present',
      sessions: [{ checkInTime: now, workMode }]
    });

    res.status(201).json({ success: true, attendance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Check out
// @route   POST /api/attendance/check-out
// @access  Private
exports.checkOut = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await Attendance.findOne({
      employeeId: req.user.id,
      date: today
    });

    if (!attendance) {
      return res.status(404).json({ success: false, message: 'Check in record not found' });
    }

    // Records created before the sessions array existed only have the top-level fields —
    // backfill so this behaves the same as a sessions-aware record
    if (attendance.sessions.length === 0 && attendance.checkInTime) {
      attendance.sessions.push({
        checkInTime: attendance.checkInTime,
        checkOutTime: attendance.checkOutTime
      });
    }

    const lastSession = attendance.sessions[attendance.sessions.length - 1];

    if (!lastSession || lastSession.checkOutTime) {
      return res.status(400).json({ success: false, message: 'You are not currently checked in' });
    }

    const now = new Date();
    lastSession.checkOutTime = now;
    attendance.checkOutTime = now;

    const totalMs = attendance.sessions.reduce(
      (sum, s) => sum + (s.checkOutTime ? Math.max(0, new Date(s.checkOutTime) - new Date(s.checkInTime)) : 0),
      0
    );
    attendance.hoursWorked = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;

    await attendance.save();

    res.status(200).json({ success: true, attendance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance records
// @route   GET /api/attendance
// @access  Private
exports.getAttendance = async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;
    const query = {};

    if (employeeId) query.employeeId = employeeId;
    
    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .populate('employeeId', 'firstName lastName email');
    res.status(200).json({ success: true, attendance });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Request an attendance correction
// @route   POST /api/attendance/correction
// @access  Private
exports.requestCorrection = async (req, res) => {
  try {
    const { date, reason, checkInTime, checkOutTime } = req.body;

    if (!date || !reason || !reason.trim()) {
      return res.status(400).json({ success: false, message: 'Date and reason are required' });
    }

    if (!checkInTime && !checkOutTime) {
      return res.status(400).json({ success: false, message: 'Provide the correct check-in time, check-out time, or both' });
    }

    const correctionDate = new Date(date);
    correctionDate.setHours(0, 0, 0, 0);

    // checkInTime/checkOutTime arrive as full ISO timestamps already combined with the
    // employee's local time zone on the client — the server must not re-derive the
    // time-of-day using its own zone, since that silently shifts the requested time.
    const correction = await AttendanceCorrection.create({
      employeeId: req.user.id,
      date: correctionDate,
      reason: reason.trim(),
      requestedCheckInTime: checkInTime ? new Date(checkInTime) : undefined,
      requestedCheckOutTime: checkOutTime ? new Date(checkOutTime) : undefined
    });

    res.status(201).json({ success: true, correction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get attendance correction requests
// @route   GET /api/attendance/correction
// @access  Private
exports.getCorrectionRequests = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    } else if (req.user.role === 'employee') {
      query.employeeId = req.user.id;
    }

    const corrections = await AttendanceCorrection.find(query)
      .sort({ createdAt: -1 })
      .populate('employeeId', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName');

    res.status(200).json({ success: true, corrections });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve/Reject an attendance correction request
// @route   PUT /api/attendance/correction/:id
// @access  Private/Manager/Admin
exports.updateCorrectionRequest = async (req, res) => {
  try {
    const { status, approvalRemarks } = req.body;

    const correction = await AttendanceCorrection.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvalRemarks,
        approvedBy: req.user.id,
        approvalDate: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!correction) {
      return res.status(404).json({ success: false, message: 'Correction request not found' });
    }

    if (status === 'approved' && (correction.requestedCheckInTime || correction.requestedCheckOutTime)) {
      const day = new Date(correction.date);
      day.setHours(0, 0, 0, 0);

      let attendance = await Attendance.findOne({ employeeId: correction.employeeId, date: day });
      if (!attendance) {
        attendance = new Attendance({ employeeId: correction.employeeId, date: day, workMode: 'WFO', sessions: [] });
      }

      if (correction.requestedCheckInTime) attendance.checkInTime = correction.requestedCheckInTime;
      if (correction.requestedCheckOutTime) attendance.checkOutTime = correction.requestedCheckOutTime;

      if (attendance.sessions.length === 0) {
        if (attendance.checkInTime) {
          attendance.sessions.push({
            checkInTime: attendance.checkInTime,
            checkOutTime: attendance.checkOutTime,
            reason: 'Attendance correction approved'
          });
        }
      } else {
        const lastSession = attendance.sessions[attendance.sessions.length - 1];
        if (correction.requestedCheckInTime) lastSession.checkInTime = correction.requestedCheckInTime;
        if (correction.requestedCheckOutTime) lastSession.checkOutTime = correction.requestedCheckOutTime;
      }

      if (attendance.checkInTime && attendance.checkOutTime) {
        const totalMs = attendance.sessions.reduce(
          (sum, s) => sum + (s.checkOutTime ? Math.max(0, new Date(s.checkOutTime) - new Date(s.checkInTime)) : 0),
          0
        );
        attendance.hoursWorked = Math.round((totalMs / (1000 * 60 * 60)) * 100) / 100;
      }

      await attendance.save();
    }

    res.status(200).json({ success: true, correction });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
