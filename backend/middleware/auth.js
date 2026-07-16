const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Look up the role fresh on every request instead of trusting the token's claim,
    // so a role change (or deactivation) takes effect immediately without requiring re-login
    // Old select (kept for reference): const user = await User.findById(decoded.id).select('role status');
    // Previous select (kept for reference): .select('role status organizationLevel')
    // isSuperAdmin/mustResetPassword are additionally selected for the
    // "improved authentication" feature (secure role assignment + forced
    // password reset) - see permissions/permissionEngine.js.
    const user = await User.findById(decoded.id).select('role status organizationLevel isSuperAdmin mustResetPassword');
    if (!user || user.status !== 'active') {
      return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
    }

    // Old assignment (kept for reference): req.user = { id: decoded.id, role: user.role };
    // Previous assignment (kept for reference): req.user = { id: decoded.id, role: user.role, organizationLevel: user.organizationLevel };
    req.user = {
      id: decoded.id,
      role: user.role,
      organizationLevel: user.organizationLevel,
      isSuperAdmin: user.isSuperAdmin,
      mustResetPassword: user.mustResetPassword
    };

    // Force-password-reset gate: while set, block everything except the
    // /api/auth/* endpoints (login already succeeded to get here via a
    // valid token, but getMe/reset-password/logout must stay reachable so
    // the user can actually clear the flag). Nobody has this flag today
    // (schema default false), so this is a no-op for every existing account.
    if (user.mustResetPassword && !req.originalUrl.startsWith('/api/auth')) {
      return res.status(403).json({
        success: false,
        code: 'PASSWORD_RESET_REQUIRED',
        message: 'Password reset required before continuing'
      });
    }

    next();
  } catch (error) {
    return res.status(401).json({ success: false, message: 'Not authorized to access this route' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `User role '${req.user.role}' is not authorized to access this route`
      });
    }
    next();
  };
};

module.exports = { protect, authorize };
