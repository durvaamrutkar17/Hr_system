export const PROBATION_MONTHS = 6;
export const PAID_LEAVE_DAYS_PER_MONTH = 2;

export const isOnProbation = (dateOfJoining, referenceDate = new Date()) => {
  if (!dateOfJoining) return false;
  const cutoff = new Date(dateOfJoining);
  cutoff.setMonth(cutoff.getMonth() + PROBATION_MONTHS);
  return new Date(referenceDate) < cutoff;
};

export const probationEndDate = (dateOfJoining) => {
  if (!dateOfJoining) return null;
  const cutoff = new Date(dateOfJoining);
  cutoff.setMonth(cutoff.getMonth() + PROBATION_MONTHS);
  return cutoff;
};

// Splits a month's approved leave requests into paid vs unpaid (absent) days.
// - Employees on probation: every leave day is unpaid.
// - Permanent employees: the first PAID_LEAVE_DAYS_PER_MONTH days taken in a calendar
//   month are paid; any further approved leave day that month is unpaid (absent).
export const computeLeavePayability = (dateOfJoining, leaves, month, year) => {
  const approvedThisMonth = (leaves || [])
    .filter((l) => l.status === 'approved')
    .filter((l) => {
      const start = new Date(l.startDate);
      return start.getMonth() + 1 === month && start.getFullYear() === year;
    })
    .sort((a, b) => new Date(a.startDate) - new Date(b.startDate));

  let paidDaysUsed = 0;

  const breakdown = approvedThisMonth.map((leave) => {
    const totalDays = leave.numberOfDays || 0;
    const onProbation = isOnProbation(dateOfJoining, leave.startDate);
    let paidDays;

    if (onProbation) {
      paidDays = 0;
    } else {
      const remainingQuota = Math.max(PAID_LEAVE_DAYS_PER_MONTH - paidDaysUsed, 0);
      paidDays = Math.min(remainingQuota, totalDays);
      paidDaysUsed += paidDays;
    }

    const unpaidDays = totalDays - paidDays;
    return { leave, totalDays, paidDays, unpaidDays, onProbation };
  });

  return {
    breakdown,
    totalPaidDays: breakdown.reduce((sum, b) => sum + b.paidDays, 0),
    totalUnpaidDays: breakdown.reduce((sum, b) => sum + b.unpaidDays, 0)
  };
};

// Expands a month's approved leave requests into individual calendar days (clipped to
// the given month/year) and resolves paid/unpaid per day in chronological order — needed
// for calendar/table views since a single multi-day request can straddle the quota boundary.
export const computeLeaveDayStatuses = (dateOfJoining, leaves, month, year) => {
  const days = [];

  (leaves || [])
    .filter((l) => l.status === 'approved')
    .forEach((leave) => {
      const start = new Date(leave.startDate);
      const end = new Date(leave.endDate);
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getMonth() + 1 === month && d.getFullYear() === year) {
          days.push({ date: new Date(d), leaveType: leave.leaveType, leaveId: leave._id });
        }
      }
    });

  days.sort((a, b) => a.date - b.date);

  let paidDaysUsed = 0;
  return days.map((day) => {
    const onProbation = isOnProbation(dateOfJoining, day.date);
    let paid;
    if (onProbation) {
      paid = false;
    } else if (paidDaysUsed < PAID_LEAVE_DAYS_PER_MONTH) {
      paid = true;
      paidDaysUsed += 1;
    } else {
      paid = false;
    }
    return { ...day, paid, onProbation };
  });
};
