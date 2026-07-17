const User = require('../models/User');

// Leave module upgrade: hierarchy approval.
//   Employee submits -> Team Lead approves -> Manager approves ->
//   Department Head approves -> HR final approval.
//
// Builds the sequential approval chain for one employee's leave request by
// walking their reportsTo chain and picking out the first person found at
// each of the Team Lead / Manager / Department Head tiers, then always
// appending a final HR stage (role-based - any Admin/HR account, not one
// specific person, since HR is a horizontal function rather than part of the
// reportsTo line). Only tiers that are actually above the employee's own
// organizationLevel are included, and only if someone was actually found at
// that tier - an employee reporting straight to a Manager with no Team Lead
// in between simply skips that stage.
//
// Returns [] when nothing in the chain could be resolved (the employee and/or
// their superiors haven't been placed in the org hierarchy yet) - callers
// should treat that as "no hierarchy chain available" and fall back to
// whatever approval flow existed before this feature.

const TIER_RANK = { Employee: 0, 'Team Lead': 1, Manager: 2, 'Department Head': 3, 'Vice President': 4, CEO: 5 };
const CHAIN_TIERS = ['Team Lead', 'Manager', 'Department Head'];

// Same shape as hierarchyController.js's reporting-chain walk, kept as its
// own lean copy here (organizationLevel/reportsTo only) since this doesn't
// need the full profile fields that endpoint returns.
async function walkReportingChain(employeeId) {
  const chain = [];
  const visited = new Set([String(employeeId)]);

  let current = await User.findById(employeeId).select('organizationLevel reportsTo');
  while (current?.reportsTo) {
    const key = String(current.reportsTo);
    if (visited.has(key)) break;

    const superior = await User.findById(current.reportsTo).select('organizationLevel reportsTo');
    if (!superior) break;

    chain.push(superior);
    visited.add(key);
    current = superior;
  }

  return chain;
}

async function buildApprovalChain(employeeId) {
  const employee = await User.findById(employeeId).select('organizationLevel');
  const employeeRank = TIER_RANK[employee?.organizationLevel] ?? 0;

  const superiors = await walkReportingChain(employeeId);

  const stages = [];
  for (const level of CHAIN_TIERS) {
    if (TIER_RANK[level] <= employeeRank) continue;
    const approver = superiors.find((s) => s.organizationLevel === level);
    if (approver) {
      stages.push({ level, approverId: approver._id, status: 'pending' });
    }
  }

  if (stages.length > 0) {
    stages.push({ level: 'HR', approverId: null, status: 'pending' });
  }

  return stages;
}

module.exports = { buildApprovalChain, walkReportingChain };
