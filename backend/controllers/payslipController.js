const Payslip = require('../models/Payslip');

// @desc    Get payslips
// @route   GET /api/payslips
// @access  Private
exports.getPayslips = async (req, res) => {
  try {
    const { employeeId, month, year } = req.query;
    const query = {};

    if (employeeId) query.employeeId = employeeId;
    if (month) query.month = parseInt(month);
    if (year) query.year = parseInt(year);

    const payslips = await Payslip.find(query)
      .sort({ year: -1, month: -1 })
      .populate('employeeId', 'firstName lastName email');
    res.status(200).json({ success: true, payslips });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Create or re-process a payslip for an employee/month (idempotent)
// @route   POST /api/payslips
// @access  Private/Manager/Admin
exports.createPayslip = async (req, res) => {
  try {
    const { employeeId, month, year, earnings, deductions } = req.body;

    const basic = earnings?.basic || 0;
    const hra = earnings?.hra || 0;
    const specialAllowance = earnings?.specialAllowance || 0;
    const grossSalary = basic + hra + specialAllowance;

    const pf = Math.round(basic * 0.12);
    const professionalTax = deductions?.professionalTax || 0;
    const tds = deductions?.tds || 0;
    const lopDays = deductions?.lopDays || 0;
    // Per-day rate off a 30-day month, standard payroll convention — not trusted from the client
    const lopAmount = lopDays > 0 ? Math.round((basic / 30) * lopDays) : 0;
    const totalDeductions = pf + professionalTax + tds + lopAmount;
    const netSalary = grossSalary - totalDeductions;

    const payslip = await Payslip.findOneAndUpdate(
      { employeeId, month, year },
      {
        earnings: { basic, hra, specialAllowance },
        deductions: { pf, professionalTax, tds, lopDays, lopAmount },
        grossSalary,
        totalDeductions,
        netSalary
      },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ success: true, payslip });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update payslip status
// @route   PUT /api/payslips/:id
// @access  Private/Admin
exports.updatePayslip = async (req, res) => {
  try {
    const { paymentStatus, paymentDate } = req.body;
    const payslip = await Payslip.findByIdAndUpdate(
      req.params.id,
      { paymentStatus, paymentDate },
      { new: true, runValidators: true }
    );

    if (!payslip) {
      return res.status(404).json({ success: false, message: 'Payslip not found' });
    }

    res.status(200).json({ success: true, payslip });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
