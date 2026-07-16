const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone is required']
  },
  designation: {
    type: String,
    required: [true, 'Designation is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required']
  },
  dateOfJoining: {
    type: Date,
    required: [true, 'Date of joining is required']
  },
  // Kept for backward compatibility (existing forms/controllers still read/write this).
  // `joiningDate` below is the new organizational-hierarchy field going forward.
  role: {
    type: String,
    enum: ['employee', 'manager', 'admin'],
    default: 'employee'
  },
  // NOTE: `role` above stays as-is (employee/manager/admin) since it drives the
  // existing authorize() middleware and route gating everywhere in the app.
  // `organizationLevel` below carries the new 8-tier hierarchy label and is
  // additive/informational — it does not replace `role` for authorization.
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Kept for backward compatibility (was already unused elsewhere in the codebase).
  // `reportsTo` below is the new canonical "immediate superior" reference.

  // ===================================================================
  // Organizational Hierarchy fields
  // Supports: CEO, Vice President, Department Head, Manager, Team Lead,
  // Employee, HR, Admin. All fields below are optional/additive so existing
  // documents and existing functionality (including login) are unaffected.
  // ===================================================================
  employeeId: {
    type: String,
    unique: true,
    sparse: true, // sparse: lets existing users without an employeeId coexist under the unique index
    trim: true
  },
  organizationLevel: {
    type: String,
    enum: ['CEO', 'Vice President', 'Department Head', 'Manager', 'Team Lead', 'Employee', 'HR', 'Admin'],
    default: 'Employee'
  },
  // Generic immediate-superior reference (replaces `reportingManager` conceptually).
  reportsTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Denormalized chain-of-command pointers, one per hierarchy level, so
  // "does X sit under manager Y" style checks don't require walking a chain.
  manager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  teamLead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  departmentHead: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  vp: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  employmentType: {
    type: String,
    enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Consultant'],
    default: 'Full-Time'
  },
  // Duplicates `dateOfJoining` above (kept for backward compatibility).
  // New hierarchy-aware code should read/write `joiningDate` going forward.
  joiningDate: {
    type: Date
  },
  // `department` and `designation` (above) and `status` (below) were already
  // present in this schema and already match what this feature needs, so
  // they are intentionally left unchanged/un-duplicated here.
  // ===================================================================
  // End Organizational Hierarchy fields
  // ===================================================================

  // ===================================================================
  // Authentication/security fields (improved auth: bootstrap super admin,
  // forced password reset, secure role assignment - see authController.js,
  // userController.js, and permissions/permissionEngine.js).
  // ===================================================================
  // True only for the very first account ever registered (bootstrapped when
  // the User collection was empty). Used to gate the most sensitive actions
  // (e.g. assigning the 'admin' role or 'CEO' organizationLevel to someone
  // else) so a regular admin can't silently mint another admin.
  isSuperAdmin: {
    type: Boolean,
    default: false
  },
  // Set by an admin/HR "force password reset" action. While true, `protect`
  // (backend/middleware/auth.js) blocks all API access outside /api/auth
  // until the user calls POST /api/auth/reset-password.
  mustResetPassword: {
    type: Boolean,
    default: false
  },
  // ===================================================================
  // End authentication/security fields
  // ===================================================================
  profileImage: {
    type: String,
    default: null
  },
  workMode: {
    type: String,
    enum: ['WFO', 'WFH', 'Hybrid'],
    default: 'WFO'
  },
  casualLeaveBalance: {
    type: Number,
    default: 6
  },
  sickLeaveBalance: {
    type: Number,
    default: 5
  },
  earnedLeaveBalance: {
    type: Number,
    default: 9
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'resigned'],
    default: 'active'
  },
  salaryStructure: {
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 }
  },
  customSalaryFields: {
    type: [{
      name: { type: String, required: true, trim: true },
      value: { type: Number, default: 0 },
      type: { type: String, enum: ['earning', 'deduction'], default: 'earning' }
    }],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
