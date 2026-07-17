// Centralized permission engine.
//
// Every "can this user do X?" decision in the backend is answered by a named
// function here instead of being re-checked inline inside routes/controllers
// (e.g. `authorize('manager', 'admin')` scattered across every route file).
//
// Each function takes the authenticated user (`req.user`, as set by the
// `protect` middleware in backend/middleware/auth.js) and returns a boolean.
// A few also accept a second `targetEmployeeId` argument for checks that
// depend on *which* employee record is being accessed.
//
// Backward compatibility: every function below reproduces exactly what the
// legacy `authorize('manager', 'admin')` calls allowed (see REVIEWER_ROLES),
// so nothing that worked before stops working. They additionally recognize
// elevated `organizationLevel` values (CEO, Vice President, Department Head,
// HR, Admin, ...) introduced by the organizational-hierarchy feature, so the
// engine becomes more capable as those fields get assigned. Today no existing
// user has an elevated organizationLevel set (schema default is 'Employee'),
// so in practice this is a pure behavioral no-op for existing accounts.

// Same two roles every `authorize('manager', 'admin')` call in the old code used.
const REVIEWER_ROLES = ['manager', 'admin'];

// organizationLevel values treated as "reviewer-equivalent" for hierarchy-aware checks.
const REVIEWER_LEVELS = ['CEO', 'Vice President', 'Department Head', 'Manager', 'Team Lead', 'HR', 'Admin'];

// organizationLevel values treated as company-wide/executive visibility.
const EXEC_LEVELS = ['CEO', 'Vice President'];

// organizationLevel values treated as admin-equivalent.
const ADMIN_LEVELS = ['CEO', 'Admin'];

const isReviewer = (user) =>
  !!user && (REVIEWER_ROLES.includes(user.role) || REVIEWER_LEVELS.includes(user.organizationLevel));

const isAdmin = (user) =>
  !!user && (user.role === 'admin' || ADMIN_LEVELS.includes(user.organizationLevel));

const isSelf = (user, targetEmployeeId) =>
  !!user && !!targetEmployeeId && String(user.id) === String(targetEmployeeId);

// ---- Leave ----
// Replaces: authorize('manager','admin') on PUT /api/leaves/:id
function canApproveLeave(user) {
  return isReviewer(user);
}

// ---- Attendance ----
// Replaces: authorize('manager','admin') on PUT /api/attendance/correction/:id
function canApproveAttendanceCorrection(user) {
  return isReviewer(user);
}
// New named permission for the "Team Attendance" page; today has the same
// outcome as isReviewer (that route had no dedicated backend check before).
function canViewTeamAttendance(user) {
  return isReviewer(user);
}

// ---- Payroll / Payslips ----
// Replaces: no authorize() previously existed on GET /api/payslips (any
// authenticated user could call it) - preserved as-is for compatibility.
function canViewPayroll(user) {
  return !!user;
}
// Replaces: authorize('manager','admin') on POST/PUT /api/payslips
function canManagePayroll(user) {
  return isReviewer(user);
}

// ---- Expenses ----
// Replaces: authorize('manager','admin') on PUT /api/expenses/:id
function canApproveExpense(user) {
  return isReviewer(user);
}

// ---- Flex hours ----
// Replaces: authorize('manager','admin') on PUT /api/flex-hours/:id
function canApproveFlexHours(user) {
  return isReviewer(user);
}

// ---- Assets ----
// Replaces: authorize('manager','admin') on POST/PUT /api/assets
function canManageAssets(user) {
  return isReviewer(user);
}

// ---- Announcements ----
// Replaces: authorize('manager','admin') on POST/PUT/DELETE /api/announcements
function canManageAnnouncements(user) {
  return isReviewer(user);
}

// ---- Holidays ----
// Replaces: authorize('manager','admin') on POST/PUT/DELETE /api/holidays
function canManageHolidays(user) {
  return isReviewer(user);
}

// ---- Documents ----
// Replaces: authorize('manager','admin') on POST /api/documents/company
// Kept for the document VERIFICATION action (any reviewer can verify a
// document's authenticity) - see canManageOfficialDocuments below for the
// narrower "who can issue an official document" check.
function canManageDocuments(user) {
  return isReviewer(user);
}
// "HR owns official employee documents" - narrower than canManageDocuments/
// isReviewer on purpose: issuing an official document (Offer Letter, PAN,
// Payslip, etc.) is now Admin/HR only, same shape as canCreateUsers. A plain
// 'manager' reviewer can still verify documents (canManageDocuments above)
// but can no longer issue/replace official ones.
function canManageOfficialDocuments(user) {
  return canCreateUsers(user);
}
// Approving/rejecting a "please issue me X" document request is the same
// Admin/HR privilege as actually issuing the document.
function canManageDocumentRequests(user) {
  return canManageOfficialDocuments(user);
}

// ---- Resignations ----
// Replaces: authorize('manager','admin') on PUT /api/resignations/:id
function canApproveResignation(user) {
  return isReviewer(user);
}

// ---- Users / Employees ----
// Replaces: authorize('manager','admin') on GET/POST /api/users, PATCH leave-balance
function canManageUsers(user) {
  return isReviewer(user);
}
// Replaces: authorize('manager','admin') on GET /api/users/:id, additionally
// allows a user to view their own record (a pure widening - the old route
// never allowed self-view, so nothing that worked before stops working).
function canViewEmployee(user, targetEmployeeId) {
  if (!user) return false;
  if (isReviewer(user)) return true;
  return isSelf(user, targetEmployeeId);
}

// ---- Authentication / user-lifecycle security ----
// "Only Admin/HR can create users" - narrower than canManageUsers/isReviewer
// on purpose: a plain 'manager' can no longer create employees or send
// invitations (previously any reviewer could via canManageUsers). Used to
// gate POST /api/users, POST /api/auth/invite, and PATCH force-password-reset.
function canCreateUsers(user) {
  return isAdmin(user) || user?.organizationLevel === 'HR';
}
// Alias kept as its own name (see canViewHierarchy above for the same
// reasoning) - today identical to canCreateUsers, may diverge later.
function canForcePasswordReset(user) {
  return canCreateUsers(user);
}
// Admin-only (not HR) - the login audit trail is a security/compliance log,
// narrower than general user management.
function canViewLoginAudit(user) {
  return isAdmin(user);
}
// Secure role assignment: any admin/HR can create or edit a user's role /
// organizationLevel, EXCEPT granting the top of the ladder (role 'admin' or
// organizationLevel 'CEO') - that requires the actor to be the bootstrapped
// isSuperAdmin, so a regular admin can never mint another admin/CEO.
function canAssignRole(user, desiredRole, desiredOrganizationLevel) {
  if (!canCreateUsers(user)) return false;
  const escalatesToTop = desiredRole === 'admin' || desiredOrganizationLevel === 'CEO';
  if (escalatesToTop && !user?.isSuperAdmin) return false;
  return true;
}

// ---- Reporting hierarchy (Get Direct Reports / Reporting Chain / Complete Hierarchy) ----
// Same self-or-reviewer shape as canViewEmployee, kept as its own named
// function since "can view this employee's profile" and "can view this
// employee's place in the org chart" are different capabilities that may
// diverge later even though they agree today.
function canViewHierarchy(user, targetEmployeeId) {
  if (!user) return false;
  if (isReviewer(user)) return true;
  return isSelf(user, targetEmployeeId);
}

// ---- Performance (Employee Profile "Performance" tab) ----
// Same self-or-reviewer shape as canViewEmployee/canViewHierarchy.
function canViewPerformance(user, targetEmployeeId) {
  if (!user) return false;
  if (isReviewer(user)) return true;
  return isSelf(user, targetEmployeeId);
}
// Only a reviewer can write a review (nobody reviews themselves).
function canManagePerformance(user) {
  return isReviewer(user);
}

// ---- Org-hierarchy scoped views (new capabilities; not yet bound to a route) ----
// Intended for future "my department only" data scoping once that filtering
// logic is added; currently equivalent to isReviewer.
function canViewDepartment(user) {
  return isReviewer(user);
}
// Narrower than isReviewer on purpose: company-wide visibility is meant for
// admins/executives, not every manager. No existing route depends on this,
// so restricting it here doesn't change any current behavior.
function canViewCompany(user) {
  return isAdmin(user) || EXEC_LEVELS.includes(user?.organizationLevel) || user?.organizationLevel === 'HR';
}

module.exports = {
  // helpers
  isReviewer,
  isAdmin,
  isSelf,
  // leave
  canApproveLeave,
  // attendance
  canApproveAttendanceCorrection,
  canViewTeamAttendance,
  // payroll
  canViewPayroll,
  canManagePayroll,
  // expenses
  canApproveExpense,
  // flex hours
  canApproveFlexHours,
  // assets
  canManageAssets,
  // announcements
  canManageAnnouncements,
  // holidays
  canManageHolidays,
  // documents
  canManageDocuments,
  canManageOfficialDocuments,
  canManageDocumentRequests,
  // resignations
  canApproveResignation,
  // users / employees
  canManageUsers,
  canViewEmployee,
  // authentication / user-lifecycle security
  canCreateUsers,
  canForcePasswordReset,
  canViewLoginAudit,
  canAssignRole,
  // reporting hierarchy
  canViewHierarchy,
  // performance
  canViewPerformance,
  canManagePerformance,
  // hierarchy-scoped views
  canViewDepartment,
  canViewCompany
};
