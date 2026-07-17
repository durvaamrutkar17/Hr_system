// Centralized permission engine (frontend mirror of
// backend/permissions/permissionEngine.js).
//
// Every "can this user do X / see Y?" decision in the UI should come from a
// named function here instead of components re-computing
// `user?.role === 'manager' || user?.role === 'admin'` inline (the old
// pattern, previously duplicated in App.js, Header.js, Sidebar.js and
// Holidays.js).
//
// Backward compatible: every function reproduces exactly what those inline
// `isReviewer` checks allowed, so nothing that worked before stops working.
// They additionally recognize elevated `organizationLevel` values (CEO,
// Vice President, Department Head, HR, Admin, ...) from the organizational
// hierarchy feature - today no existing user has one of those set, so this
// is a no-op in practice until that field is actually assigned.

const REVIEWER_ROLES = ['manager', 'admin'];
const REVIEWER_LEVELS = ['CEO', 'Vice President', 'Department Head', 'Manager', 'Team Lead', 'HR', 'Admin'];
const EXEC_LEVELS = ['CEO', 'Vice President'];
const ADMIN_LEVELS = ['CEO', 'Admin'];

export const isReviewer = (user) =>
  !!user && (REVIEWER_ROLES.includes(user.role) || REVIEWER_LEVELS.includes(user.organizationLevel));

export const isAdmin = (user) =>
  !!user && (user.role === 'admin' || ADMIN_LEVELS.includes(user.organizationLevel));

export const isSelf = (user, targetEmployeeId) =>
  !!user && !!targetEmployeeId && String(user._id) === String(targetEmployeeId);

// ---- Leave ----
export const canApproveLeave = (user) => isReviewer(user);

// ---- Attendance ----
export const canApproveAttendanceCorrection = (user) => isReviewer(user);
export const canViewTeamAttendance = (user) => isReviewer(user);

// ---- Payroll / Payslips ----
export const canViewPayroll = (user) => !!user;
export const canManagePayroll = (user) => isReviewer(user);

// ---- Expenses ----
export const canApproveExpense = (user) => isReviewer(user);

// ---- Flex hours ----
export const canApproveFlexHours = (user) => isReviewer(user);

// ---- Assets ----
export const canManageAssets = (user) => isReviewer(user);

// ---- Announcements ----
export const canManageAnnouncements = (user) => isReviewer(user);

// ---- Holidays ----
export const canManageHolidays = (user) => isReviewer(user);

// ---- Documents ----
export const canManageDocuments = (user) => isReviewer(user);

// ---- Resignations ----
export const canApproveResignation = (user) => isReviewer(user);

// ---- Users / Employees ----
export const canManageUsers = (user) => isReviewer(user);
export const canViewEmployee = (user, targetEmployeeId) => {
  if (!user) return false;
  if (isReviewer(user)) return true;
  return isSelf(user, targetEmployeeId);
};

// ---- Authentication / user-lifecycle security ----
// "Only Admin/HR can create users" - narrower than canManageUsers/isReviewer
// on purpose: a plain 'manager' can no longer create employees or send
// invitations from the UI (see Employees.js, which now gates the "Add
// Employee" button on this instead of on canManageUsers/isReviewer).
export const canCreateUsers = (user) => isAdmin(user) || user?.organizationLevel === 'HR';
export const canForcePasswordReset = (user) => canCreateUsers(user);
// "HR owns official employee documents" - narrower than canManageDocuments.
export const canManageOfficialDocuments = (user) => canCreateUsers(user);
export const canManageDocumentRequests = (user) => canManageOfficialDocuments(user);
export const canViewLoginAudit = (user) => isAdmin(user);
export const canAssignRole = (user, desiredRole, desiredOrganizationLevel) => {
  if (!canCreateUsers(user)) return false;
  const escalatesToTop = desiredRole === 'admin' || desiredOrganizationLevel === 'CEO';
  if (escalatesToTop && !user?.isSuperAdmin) return false;
  return true;
};

// ---- Reporting hierarchy (Get Direct Reports / Reporting Chain / Complete Hierarchy) ----
export const canViewHierarchy = (user, targetEmployeeId) => {
  if (!user) return false;
  if (isReviewer(user)) return true;
  return isSelf(user, targetEmployeeId);
};

// ---- Performance (Employee Profile "Performance" tab) ----
export const canViewPerformance = (user, targetEmployeeId) => {
  if (!user) return false;
  if (isReviewer(user)) return true;
  return isSelf(user, targetEmployeeId);
};
export const canManagePerformance = (user) => isReviewer(user);

// ---- Org-hierarchy scoped views (new; not yet bound to a page) ----
export const canViewDepartment = (user) => isReviewer(user);
export const canViewCompany = (user) =>
  isAdmin(user) || EXEC_LEVELS.includes(user?.organizationLevel) || user?.organizationLevel === 'HR';
