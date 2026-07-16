const crypto = require('crypto');
const User = require('../models/User');
const { canAssignRole } = require('../permissions/permissionEngine');

// @desc    Get all employees (for manager/admin selectors)
// @route   GET /api/users
// @access  Private/Manager/Admin
exports.getUsers = async (req, res) => {
  try {
    // Old select (kept for reference): no organizational-hierarchy fields.
    // .select('firstName lastName email phone designation department role dateOfJoining workMode casualLeaveBalance sickLeaveBalance earnedLeaveBalance salaryStructure customSalaryFields createdAt')
    const users = await User.find({ status: 'active' })
      .select('firstName lastName email phone designation department role dateOfJoining workMode casualLeaveBalance sickLeaveBalance earnedLeaveBalance salaryStructure customSalaryFields createdAt employeeId organizationLevel reportsTo manager teamLead departmentHead vp employmentType joiningDate')
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
    // Old select (kept for reference): no organizational-hierarchy fields.
    // .select('firstName lastName email phone designation department role status dateOfJoining workMode casualLeaveBalance sickLeaveBalance earnedLeaveBalance salaryStructure customSalaryFields createdAt')
    const user = await User.findById(req.params.id)
      .select('firstName lastName email phone designation department role status dateOfJoining workMode casualLeaveBalance sickLeaveBalance earnedLeaveBalance salaryStructure customSalaryFields createdAt employeeId organizationLevel reportsTo manager teamLead departmentHead vp employmentType joiningDate')
      .populate('reportsTo', 'firstName lastName role organizationLevel')
      .populate('manager', 'firstName lastName role organizationLevel')
      .populate('teamLead', 'firstName lastName role organizationLevel')
      .populate('departmentHead', 'firstName lastName role organizationLevel')
      .populate('vp', 'firstName lastName role organizationLevel');

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
    // Old destructure (kept for reference): no organizational-hierarchy fields.
    // const { firstName, lastName, email, password, phone, designation, department, dateOfJoining, role, workMode, salaryStructure, customSalaryFields } = req.body;
    const {
      firstName, lastName, email, password, phone, designation, department, dateOfJoining, role, workMode, salaryStructure, customSalaryFields,
      // Organizational-hierarchy fields (all optional; requests that omit them behave exactly as before).
      employeeId, organizationLevel, reportsTo, manager, teamLead, departmentHead, vp, employmentType, joiningDate
    } = req.body;

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

    // Organizational-hierarchy fields are only set when provided, so requests
    // from the existing "Add Employee" form (which doesn't send them) behave
    // exactly as before and rely on the model's defaults/optionality.
    const hierarchyFields = {};
    if (employeeId) hierarchyFields.employeeId = employeeId;
    if (organizationLevel) hierarchyFields.organizationLevel = organizationLevel;
    if (reportsTo) hierarchyFields.reportsTo = reportsTo;
    if (manager) hierarchyFields.manager = manager;
    if (teamLead) hierarchyFields.teamLead = teamLead;
    if (departmentHead) hierarchyFields.departmentHead = departmentHead;
    if (vp) hierarchyFields.vp = vp;
    if (employmentType) hierarchyFields.employmentType = employmentType;
    if (joiningDate) hierarchyFields.joiningDate = joiningDate;

    // Secure role assignment: old coercion (kept for reference) capped every
    // creator at 'manager', so even an admin could never mint another admin
    // through this endpoint:
    // role: role === 'manager' ? 'manager' : 'employee',
    // Now the cap is delegated to canAssignRole - a regular admin/HR creator
    // is still capped at 'manager' (canAssignRole rejects 'admin'/'CEO' for
    // anyone but the Super Admin), but the Super Admin can create another
    // admin directly here if they choose to.
    const desiredRole = role === 'manager' ? 'manager' : role === 'admin' ? 'admin' : 'employee';
    const desiredLevel = hierarchyFields.organizationLevel || 'Employee';
    if (!canAssignRole(req.user, desiredRole, desiredLevel)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to assign that role/level' });
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
      role: desiredRole,
      workMode: ['WFO', 'WFH', 'Hybrid'].includes(workMode) ? workMode : 'WFO',
      salaryStructure: {
        basic: toNonNegative(salaryStructure?.basic),
        hra: toNonNegative(salaryStructure?.hra),
        specialAllowance: toNonNegative(salaryStructure?.specialAllowance),
        professionalTax: toNonNegative(salaryStructure?.professionalTax),
        tds: toNonNegative(salaryStructure?.tds)
      },
      customSalaryFields: customFields,
      ...hierarchyFields
    });

    const userSafe = user.toObject();
    delete userSafe.password;

    res.status(201).json({ success: true, user: userSafe });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Change an existing employee's role/organizationLevel (secure role
//          assignment - see permissions/permissionEngine.js canAssignRole:
//          only the Super Admin can grant 'admin'/'CEO').
// @route   PATCH /api/users/:id/role
// @access  Private/Admin/HR (canAssignRole, checked here since it needs the
//          *desired* role/level from the body, not just the caller's own role)
exports.assignRole = async (req, res) => {
  try {
    const { role, organizationLevel } = req.body;

    if (role && !['employee', 'manager', 'admin'].includes(role)) {
      return res.status(400).json({ success: false, message: 'Invalid role' });
    }
    const validLevels = ['CEO', 'Vice President', 'Department Head', 'Manager', 'Team Lead', 'Employee', 'HR', 'Admin'];
    if (organizationLevel && !validLevels.includes(organizationLevel)) {
      return res.status(400).json({ success: false, message: 'Invalid organizationLevel' });
    }

    const target = await User.findById(req.params.id);
    if (!target) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const desiredRole = role || target.role;
    const desiredLevel = organizationLevel || target.organizationLevel;
    if (!canAssignRole(req.user, desiredRole, desiredLevel)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to assign that role/level' });
    }

    if (role) target.role = role;
    if (organizationLevel) target.organizationLevel = organizationLevel;
    await target.save();

    const userSafe = target.toObject();
    delete userSafe.password;

    res.status(200).json({ success: true, user: userSafe });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Force an employee to reset their password: generates a new
//          temporary password and sets mustResetPassword so `protect`
//          (backend/middleware/auth.js) blocks them from doing anything else
//          until they call POST /api/auth/reset-password.
// @route   PATCH /api/users/:id/force-password-reset
// @access  Private/Admin/HR (canForcePasswordReset)
exports.forcePasswordReset = async (req, res) => {
  try {
    const target = await User.findById(req.params.id).select('+password');
    if (!target) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    // No email/SMTP integration exists in this project, so the temporary
    // password is returned directly to the admin/HR caller to share manually.
    const temporaryPassword = crypto.randomBytes(6).toString('hex');
    target.password = temporaryPassword;
    target.mustResetPassword = true;
    await target.save();

    res.status(200).json({ success: true, message: 'Password reset forced', temporaryPassword });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
