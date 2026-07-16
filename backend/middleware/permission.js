// Generic authorization middleware that delegates the actual "can this user
// do this?" decision to a permission function from
// backend/permissions/permissionEngine.js, instead of hardcoding role checks
// inside each route file (the old pattern: `authorize('manager', 'admin')`).
//
// Usage:
//   router.put('/:id', protect, requirePermission(canApproveLeave), updateLeave);
//
// For permission functions that need to know *which* employee record is
// being targeted (e.g. canViewEmployee), tell the middleware where to read
// the target id from:
//   router.get('/:id', protect, requirePermission(canViewEmployee, { paramKey: 'id' }), getUserById);
const requirePermission = (permissionFn, options = {}) => {
  return (req, res, next) => {
    const targetEmployeeId = options.paramKey
      ? req.params[options.paramKey]
      : options.bodyKey
        ? req.body[options.bodyKey]
        : undefined;

    const allowed = permissionFn(req.user, targetEmployeeId);

    if (!allowed) {
      // Same response shape/message as the legacy authorize() middleware
      // (backend/middleware/auth.js) so existing frontend error handling
      // for 403s keeps working unchanged.
      return res.status(403).json({
        success: false,
        message: `User role '${req.user?.role}' is not authorized to access this route`
      });
    }

    next();
  };
};

module.exports = { requirePermission };
