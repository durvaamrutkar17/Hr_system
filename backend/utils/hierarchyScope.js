const User = require('../models/User');

// Attendance module upgrade: hierarchy-based visibility.
//
//   Employee        -> own attendance only
//   Team Lead       -> own team (direct reports)
//   Manager         -> entire team (direct + indirect reports, recursively)
//   Department Head -> everyone in their department
//   Vice President   -> their whole division (everyone under them, recursively)
//   CEO / HR        -> entire company
//
// This lives outside permissions/permissionEngine.js because every function
// there is a synchronous, pure `(user, targetId) => boolean` check - this one
// needs to walk the reportsTo chain in the database, so it can't be
// synchronous. It's shared by attendanceController.js for both listing
// (getAttendance/getCorrectionRequests) and correction-approval authorization
// (updateCorrectionRequest), so "who can see it" and "who can approve it"
// can never drift apart.

const COMPANY_WIDE_LEVELS = ['CEO', 'HR'];
const HIERARCHY_SCOPE_LEVELS = ['Team Lead', 'Manager', 'Vice President'];

const isAdminUser = (user) =>
  !!user && (user.role === 'admin' || user.organizationLevel === 'CEO' || user.organizationLevel === 'Admin');

// Recursively collects every employee id reporting up to `rootId` (directly
// or through intermediate levels), including rootId itself. A `visited` guard
// prevents infinite loops if the reportsTo data ever has a cycle.
async function collectDescendantIds(rootId, visited = new Set()) {
  const key = String(rootId);
  if (visited.has(key)) return visited;
  visited.add(key);

  const children = await User.find({ reportsTo: rootId }).select('_id').lean();
  for (const child of children) {
    await collectDescendantIds(child._id, visited);
  }
  return visited;
}

// Returns the string 'ALL' (no filtering needed - company-wide access) or an
// array of employee id strings this user is allowed to see. Always includes
// the user's own id when a concrete list is returned.
async function getVisibleEmployeeIds(user) {
  if (!user) return [];

  if (isAdminUser(user) || COMPANY_WIDE_LEVELS.includes(user.organizationLevel)) {
    return 'ALL';
  }

  if (user.organizationLevel === 'Department Head') {
    const self = await User.findById(user.id).select('department');
    if (!self?.department) return [String(user.id)];
    const deptUsers = await User.find({ department: self.department }).select('_id').lean();
    return deptUsers.map((u) => String(u._id));
  }

  if (HIERARCHY_SCOPE_LEVELS.includes(user.organizationLevel)) {
    const ids = await collectDescendantIds(user.id);
    return Array.from(ids);
  }

  // Legacy bridge: an existing 'manager'-role account that hasn't been
  // assigned an organizationLevel yet (schema default is 'Employee') keeps
  // today's behavior - company-wide - so nothing that worked before this
  // upgrade stops working. Once organizationLevel is actually set to a real
  // tier for that account, the hierarchy-aware branches above take over.
  if (user.role === 'manager') {
    return 'ALL';
  }

  // Plain employee (or a manager/HR account not yet placed in the hierarchy):
  // own records only.
  return [String(user.id)];
}

// Convenience wrapper for a single-target check (e.g. "can this approver act
// on this employee's correction request?").
async function canAccessEmployeeViaHierarchy(user, targetEmployeeId) {
  if (!user || !targetEmployeeId) return false;
  if (String(user.id) === String(targetEmployeeId)) return true;

  const visible = await getVisibleEmployeeIds(user);
  if (visible === 'ALL') return true;
  return visible.includes(String(targetEmployeeId));
}

module.exports = { getVisibleEmployeeIds, canAccessEmployeeViaHierarchy, collectDescendantIds };
