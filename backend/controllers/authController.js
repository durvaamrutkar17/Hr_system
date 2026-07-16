const User = require('../models/User');
const Invitation = require('../models/Invitation');
const LoginAudit = require('../models/LoginAudit');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { canAssignRole } = require('../permissions/permissionEngine');

// Writes one row per login attempt (success or failure). Never lets a
// logging failure block the actual login response.
const recordLoginAudit = async ({ email, user, success, reason, req }) => {
  try {
    await LoginAudit.create({
      user: user || undefined,
      email,
      success,
      reason,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent']
    });
  } catch (auditError) {
    console.error('Failed to record login audit:', auditError.message);
  }
};

// @desc    Register user - bootstrap only (see requirements below)
// @route   POST /api/auth/register
// @access  Public, but only while the User collection is empty
exports.register = async (req, res) => {
  try {
    // Old body (kept for reference - unconditional public registration,
    // anyone could self-register at any time with the default 'employee' role):
    // const { firstName, lastName, email, password, phone, designation, department, dateOfJoining } = req.body;
    // const userExists = await User.findOne({ email });
    // if (userExists) {
    //   return res.status(400).json({ success: false, message: 'Email already in use' });
    // }
    // const user = await User.create({ firstName, lastName, email, password, phone, designation, department, dateOfJoining });

    // Public registration only ever bootstraps the very first account (the
    // Super Admin). Once at least one user exists, everyone else must come
    // in through an Admin/HR invite (inviteUser below) or a direct
    // Admin/HR-created account (userController.createEmployee).
    const existingUserCount = await User.countDocuments();
    if (existingUserCount > 0) {
      return res.status(403).json({
        success: false,
        message: 'Public registration is disabled. Ask an administrator for an invite.'
      });
    }

    const { firstName, lastName, email, password, phone, designation, department, dateOfJoining } = req.body;

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    // The first registered user becomes the Super Admin. role/organizationLevel/
    // isSuperAdmin are forced here (ignoring anything sent in the request
    // body) so nobody can self-elevate by passing those fields in the payload.
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      phone,
      designation,
      department,
      dateOfJoining,
      role: 'admin',
      organizationLevel: 'CEO',
      isSuperAdmin: true
    });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.status(201).json({
      success: true,
      token,
      user
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Is public registration still open? (true only before the Super
//          Admin exists) - lets the frontend hide the register form/link.
// @route   GET /api/auth/registration-status
// @access  Public
exports.getRegistrationStatus = async (req, res) => {
  try {
    const count = await User.countDocuments();
    res.status(200).json({ success: true, open: count === 0 });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Please provide email and password' });
    }

    const user = await User.findOne({ email }).select('+password');

    // Old checks (kept for reference - same outcome, just without audit logging
    // and without an explicit inactive-account check; an inactive/resigned
    // user could previously get a token here and only get blocked on their
    // *next* request by `protect`'s status check):
    // if (!user) {
    //   return res.status(401).json({ success: false, message: 'Invalid credentials' });
    // }
    // const isMatch = await user.matchPassword(password);
    // if (!isMatch) {
    //   return res.status(401).json({ success: false, message: 'Invalid credentials' });
    // }

    if (!user) {
      await recordLoginAudit({ email, success: false, reason: 'not_found', req });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    if (user.status !== 'active') {
      await recordLoginAudit({ email, user: user._id, success: false, reason: 'inactive_account', req });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await recordLoginAudit({ email, user: user._id, success: false, reason: 'invalid_credentials', req });
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    await recordLoginAudit({ email, user: user._id, success: true, reason: 'success', req });

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    // Old response (kept for reference): res.status(200).json({ success: true, token, user });
    // mustResetPassword is surfaced so the frontend can immediately route the
    // user to the forced-reset page; existing frontend code that only reads
    // `token`/`user` is unaffected by the extra field.
    res.status(200).json({
      success: true,
      token,
      user,
      mustResetPassword: !!user.mustResetPassword
    });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get current logged in user
// @route   GET /api/auth/me
// @access  Private
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    res.status(200).json({ success: true, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Change the logged-in user's own password (also clears a pending
//          forced-reset flag). Reachable even while mustResetPassword is set,
//          because /api/auth/* is exempted from that block in `protect`.
// @route   POST /api/auth/reset-password
// @access  Private
exports.resetPassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: 'Please provide current and new password' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user.id).select('+password');
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    user.mustResetPassword = false;
    await user.save();

    res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Invite a new employee by email - creates a pending Invitation; no
//          User document exists until they accept and set their own password
//          (see setupPasswordFromInvite below), so an outstanding invite never
//          shows up as an employee anywhere in the app.
// @route   POST /api/auth/invite
// @access  Private/Admin/HR (canCreateUsers, enforced in routes/authRoutes.js)
exports.inviteUser = async (req, res) => {
  try {
    const {
      email, firstName, lastName, phone, designation, department, dateOfJoining,
      role, organizationLevel, reportsTo, manager, teamLead, departmentHead, vp, employmentType
    } = req.body;

    if (!email || !firstName || !lastName) {
      return res.status(400).json({ success: false, message: 'Email, first name and last name are required' });
    }

    const normalizedEmail = String(email).toLowerCase().trim();

    const userExists = await User.findOne({ email: normalizedEmail });
    if (userExists) {
      return res.status(400).json({ success: false, message: 'Email already in use' });
    }

    const existingInvite = await Invitation.findOne({ email: normalizedEmail, status: 'pending' });
    if (existingInvite) {
      return res.status(400).json({ success: false, message: 'An invitation is already pending for this email' });
    }

    // Secure role assignment: the inviter can never grant a role/organizationLevel
    // above their own privilege - only the bootstrapped Super Admin can invite
    // someone in as 'admin' or organizationLevel 'CEO'.
    const desiredRole = role === 'manager' ? 'manager' : role === 'admin' ? 'admin' : 'employee';
    const desiredLevel = organizationLevel || 'Employee';
    if (!canAssignRole(req.user, desiredRole, desiredLevel)) {
      return res.status(403).json({ success: false, message: 'You are not authorized to assign that role/level' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    const invitation = await Invitation.create({
      email: normalizedEmail,
      firstName,
      lastName,
      phone,
      designation,
      department,
      dateOfJoining,
      role: desiredRole,
      organizationLevel: desiredLevel,
      reportsTo: reportsTo || undefined,
      manager: manager || undefined,
      teamLead: teamLead || undefined,
      departmentHead: departmentHead || undefined,
      vp: vp || undefined,
      employmentType,
      token,
      invitedBy: req.user.id,
      expiresAt
    });

    // No email/SMTP integration exists in this project, so the invite link
    // is returned directly to the inviter to share manually.
    const inviteLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/accept-invite/${token}`;

    res.status(201).json({ success: true, invitation, inviteLink });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Look up a pending invitation by token (for the "set your
//          password" page - see frontend/src/pages/AcceptInvite.js)
// @route   GET /api/auth/invite/:token
// @access  Public (the token itself is the credential)
exports.getInvitation = async (req, res) => {
  try {
    const invitation = await Invitation.findOne({ token: req.params.token })
      .select('email firstName lastName designation department role organizationLevel status expiresAt');

    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
      return res.status(404).json({ success: false, message: 'Invitation not found or expired' });
    }

    res.status(200).json({ success: true, invitation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Accept an invitation and set a password - this is what actually
//          creates the User document.
// @route   POST /api/auth/invite/:token/setup-password
// @access  Public (the token itself is the credential)
exports.setupPasswordFromInvite = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ success: false, message: 'Password must be at least 6 characters' });
    }

    const invitation = await Invitation.findOne({ token: req.params.token });
    if (!invitation || invitation.status !== 'pending' || invitation.expiresAt < new Date()) {
      return res.status(404).json({ success: false, message: 'Invitation not found or expired' });
    }

    const userExists = await User.findOne({ email: invitation.email });
    if (userExists) {
      invitation.status = 'revoked';
      await invitation.save();
      return res.status(400).json({ success: false, message: 'An account already exists for this email' });
    }

    const user = await User.create({
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      email: invitation.email,
      password,
      phone: invitation.phone,
      designation: invitation.designation,
      department: invitation.department,
      dateOfJoining: invitation.dateOfJoining || new Date(),
      role: invitation.role,
      organizationLevel: invitation.organizationLevel,
      reportsTo: invitation.reportsTo,
      manager: invitation.manager,
      teamLead: invitation.teamLead,
      departmentHead: invitation.departmentHead,
      vp: invitation.vp,
      employmentType: invitation.employmentType
    });

    invitation.status = 'accepted';
    invitation.acceptedAt = new Date();
    await invitation.save();

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE
    });

    res.status(201).json({ success: true, token, user });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    List recent login attempts (security/compliance audit trail)
// @route   GET /api/auth/login-audit
// @access  Private/Admin (canViewLoginAudit, enforced in routes/authRoutes.js)
exports.getLoginAudit = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 100, 500);
    const entries = await LoginAudit.find()
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('user', 'firstName lastName email role');

    res.status(200).json({ success: true, entries });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
