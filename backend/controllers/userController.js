const User = require('../models/User');

// @desc    Get all employees (for manager/admin selectors)
// @route   GET /api/users
// @access  Private/Manager/Admin
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({ status: 'active' })
      .select('firstName lastName email phone designation department role dateOfJoining workMode casualLeaveBalance sickLeaveBalance earnedLeaveBalance')
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
    const { firstName, lastName, email, password, phone, designation, department, dateOfJoining, role } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
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
      role: role === 'manager' ? 'manager' : 'employee'
    });

    const userSafe = user.toObject();
    delete userSafe.password;

    res.status(201).json({ success: true, user: userSafe });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
