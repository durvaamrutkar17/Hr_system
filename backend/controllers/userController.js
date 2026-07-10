const User = require('../models/User');

// @desc    Get all employees (for manager/admin selectors)
// @route   GET /api/users
// @access  Private/Manager/Admin
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'active' })
      .select('firstName lastName email phone designation department role dateOfJoining workMode casualLeaveBalance sickLeaveBalance earnedLeaveBalance salaryStructure customSalaryFields createdAt')
      .sort({ firstName: 1 });

    res.status(200).json({ success: true, users });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get a single employee by id (includes resigned/inactive, for profile view)
// @route   GET /api/users/:id
// @access  Private/Manager/Admin
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('firstName lastName email phone designation department role status dateOfJoining workMode casualLeaveBalance sickLeaveBalance earnedLeaveBalance salaryStructure customSalaryFields createdAt');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update an employee's leave balance
// @route   PATCH /api/users/:id/leave-balance
// @access  Private/Manager/Admin
exports.updateLeaveBalance = async (req, res) => {
  try {
    const { casualLeaveBalance, sickLeaveBalance, earnedLeaveBalance } = req.body;
    const toNonNegative = (value) => Math.max(0, Number(value) || 0);

    const user = await User.findByIdAndUpdate(
      req.params.id,
      {
        casualLeaveBalance: toNonNegative(casualLeaveBalance),
        sickLeaveBalance: toNonNegative(sickLeaveBalance),
        earnedLeaveBalance: toNonNegative(earnedLeaveBalance)
      },
      { new: true, runValidators: true }
    ).select('firstName lastName casualLeaveBalance sickLeaveBalance earnedLeaveBalance');

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Add a new employee
// @route   POST /api/users
// @access  Private/Manager/Admin
exports.createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, designation, department, dateOfJoining, role, workMode, salaryStructure, customSalaryFields } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const toNonNegative = (value) => Math.max(0, Number(value) || 0);

    const customFields = [];
    if (Array.isArray(customSalaryFields)) {
      customSalaryFields.forEach((field) => {
        const name = (field?.name || '').trim();
        if (name) {
          customFields.push({
            name,
            value: toNonNegative(field?.value),
            type: field?.type === 'deduction' ? 'deduction' : 'earning'
          });
        }
      });
    }

    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      designation,
      department,
      dateOfJoining,
      role: role === 'manager' ? 'manager' : 'employee',
      workMode: ['WFO', 'WFH', 'Hybrid'].includes(workMode) ? workMode : 'WFO',
      salaryStructure: {
        basic: toNonNegative(salaryStructure?.basic),
        hra: toNonNegative(salaryStructure?.hra),
        specialAllowance: toNonNegative(salaryStructure?.specialAllowance),
        professionalTax: toNonNegative(salaryStructure?.professionalTax),
        tds: toNonNegative(salaryStructure?.tds)
      },
      customSalaryFields: customFields
    });

    const userSafe = user.toObject();
    delete userSafe.password;

    res.status(201).json({ success: true, user: userSafe });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
