const User = require('../models/User');

// The reporting chain this feature implements (bottom to top), driven by the
// `reportsTo` field on User (see backend/models/User.js):
//   Employee -> Team Lead -> Manager -> Department Head -> Vice President -> CEO
// This list is documentation/reference only - the APIs below walk `reportsTo`
// generically (recursively, level-agnostic) rather than hardcoding 5 hops,
// so they keep working even if more levels are inserted later.
const HIERARCHY_LEVELS = ['Employee', 'Team Lead', 'Manager', 'Department Head', 'Vice President', 'CEO'];

const SUMMARY_FIELDS = 'firstName lastName email designation department role organizationLevel reportsTo employeeId status';

// Recursively builds { ...user, directReports: [...] } for everyone under `userId`.
// `visited` guards against a corrupt/cyclic reportsTo chain (e.g. A reports to
// B and B reports to A) so a bad record can never cause an infinite loop.
const buildSubtree = async (userId, visited = new Set()) => {
  const key = String(userId);
  if (visited.has(key)) return null;
  visited.add(key);

  const user = await User.findById(userId).select(SUMMARY_FIELDS).lean();
  if (!user) return null;

  const children = await User.find({ reportsTo: userId }).select('_id').lean();

  const directReports = [];
  for (const child of children) {
    const subtree = await buildSubtree(child._id, visited);
    if (subtree) directReports.push(subtree);
  }

  return { ...user, directReports };
};

// @desc    Get an employee's direct reports (one level down only)
// @route   GET /api/hierarchy/direct-reports/:id
// @access  Private (self or reviewer - see permissions/permissionEngine.js canViewHierarchy)
exports.getDirectReports = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await User.findById(id).select(SUMMARY_FIELDS);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const directReports = await User.find({ reportsTo: id })
      .select(SUMMARY_FIELDS)
      .sort({ firstName: 1 });

    res.status(200).json({ success: true, employee, directReports });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get the complete (recursive) hierarchy under a given employee, or
//          the whole company tree if no id is given (roots = users with no reportsTo set)
// @route   GET /api/hierarchy/complete/:id?
// @access  Private/Manager/Admin (canManageUsers - same gate as GET /api/users)
exports.getCompleteHierarchy = async (req, res) => {
  try {
    const { id } = req.params;

    if (id) {
      const root = await User.findById(id);
      if (!root) {
        return res.status(404).json({ success: false, message: 'Employee not found' });
      }
      const hierarchy = await buildSubtree(id);
      return res.status(200).json({ success: true, hierarchy });
    }

    // No id given: build a forest from every top-level user (nobody they report to).
    const roots = await User.find({
      status: 'active',
      $or: [{ reportsTo: null }, { reportsTo: { $exists: false } }]
    }).select('_id').lean();

    const hierarchy = [];
    const visited = new Set();
    for (const root of roots) {
      const subtree = await buildSubtree(root._id, visited);
      if (subtree) hierarchy.push(subtree);
    }

    res.status(200).json({ success: true, hierarchy });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Get the reporting chain from an employee up to the top of the org (e.g. CEO)
// @route   GET /api/hierarchy/reporting-chain/:id
// @access  Private (self or reviewer - see permissions/permissionEngine.js canViewHierarchy)
exports.getReportingChain = async (req, res) => {
  try {
    const { id } = req.params;

    const employee = await User.findById(id).select(SUMMARY_FIELDS);
    if (!employee) {
      return res.status(404).json({ success: false, message: 'Employee not found' });
    }

    const chain = [];
    const visited = new Set([String(employee._id)]);
    let current = employee;

    // Recursive walk up the chain (Employee -> Team Lead -> Manager ->
    // Department Head -> VP -> CEO), stopping at whoever has no reportsTo,
    // or if a cycle is detected.
    while (current.reportsTo) {
      const key = String(current.reportsTo);
      if (visited.has(key)) break;

      const superior = await User.findById(current.reportsTo).select(SUMMARY_FIELDS);
      if (!superior) break;

      chain.push(superior);
      visited.add(key);
      current = superior;
    }

    res.status(200).json({ success: true, employee, chain });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.HIERARCHY_LEVELS = HIERARCHY_LEVELS;
