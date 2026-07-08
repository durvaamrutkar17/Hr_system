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

// @desc    Add a new employee
// @route   POST /api/users
// @access  Private/Manager/Admin
exports.createEmployee = async (req, res) => {
  try {
    const { firstName, lastName, email, password, phone, designation, department, dateOfJoining, role, workMode, salaryStructure } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const toNonNegative = (value) => Math.max(0, Number(value) || 0);

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
      }
    });

    const userSafe = user.toObject();
    delete userSafe.password;

    res.status(201).json({ success: true, user: userSafe });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Save an employee's custom salary fields
// @route   PUT /api/users/:id/custom-fields
// @access  Private/Manager/Admin
exports.updateCustomFields = async (req, res) => {
  try {
    const { fields } = req.body;
    if (!Array.isArray(fields)) {
      return res.status(400).json({ success: false, message: 'fields must be an array' });
    }

    const customSalaryFields = {};
    fields.forEach((field) => {
      const name = (field?.name || '').trim();
      if (name) {
        customSalaryFields[name] = field?.value != null ? String(field.value) : '';
      }
    });

    const user = await User.findByIdAndUpdate(
      req.params.id,
      { customSalaryFields },
      { new: true, runValidators: true }
    );

    if (!user) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    res.status(200).json({ success: true, customSalaryFields: Object.fromEntries(user.customSalaryFields || []) });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
