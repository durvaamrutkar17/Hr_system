import { computeLeaveDayStatuses } from './leavePolicy';

// Shortfalls this small (e.g. clocking out at 8.98 hrs instead of 9) are within normal
// rounding/clock-drift and shouldn't cost someone their Present/Half Day status.
const GRACE_HOURS = 10 / 60;

// Saturdays are a half-day (5 hrs = full present, no separate half-day tier).
// Sundays are a company holiday when there's no actual check-in that day.
// `appliedFlex` is hours banked from past days and applied (via an approved-or-pending
// flex hours request) to cover a shortfall on this day, so it's treated as present even
// though the raw checked-in time falls short — it reverts if the request is rejected.
export const getDayStatus = (record, date, appliedFlex = 0) => {
  const dayOfWeek = new Date(date).getDay();
  const checkedIn = !!record?.checkInTime;

  if (!checkedIn) {
    if (dayOfWeek === 0) return { label: 'Holiday', className: 'holiday' };
    return { label: 'Absent', className: 'absent', detail: 'No check-in recorded' };
  }

  // Checked in but not checked out yet (still working, or forgot to check out and
  // hasn't been corrected) — hours aren't final, so judge by check-in alone: present.
  if (!record.checkOutTime) {
    return { label: 'Present', className: 'present' };
  }

  const rawHours = record.hoursWorked || 0;
  const hours = rawHours + appliedFlex;
  const presentThreshold = dayOfWeek === 6 ? 5 : 9;
  const halfDayThreshold = 5;
  const flexNote = appliedFlex > 0 ? ` + ${appliedFlex.toFixed(2)} flex hrs applied` : '';

  if (hours >= presentThreshold - GRACE_HOURS) {
    return {
      label: 'Present',
      className: 'present',
      detail: `Worked ${rawHours.toFixed(2)} hrs${flexNote} (${presentThreshold} required)`
    };
  }
  if (dayOfWeek !== 6 && hours >= halfDayThreshold - GRACE_HOURS) {
    return {
      label: 'Half Day',
      className: 'half-day',
      detail: `Worked ${rawHours.toFixed(2)} hrs${flexNote} — needs ${presentThreshold} hrs for Present`
    };
  }
  return {
    label: 'Absent',
    className: 'absent',
    detail: `Worked ${rawHours.toFixed(2)} hrs${flexNote} — needs ${halfDayThreshold} hrs for Half Day, ${presentThreshold} for Present`
  };
};

// Builds one row per calendar day from the later of (month start, date of joining) through
// the earlier of (month end, today), so history shows the whole month — including days with
// no attendance record at all — instead of only days an Attendance document happens to exist for.
export const buildMonthAttendanceRows = ({ dateOfJoining, attendance, leaves, month, year }) => {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const joinTime = dateOfJoining ? new Date(dateOfJoining).setHours(0, 0, 0, 0) : monthStart.getTime();
  const rangeStart = new Date(Math.max(monthStart.getTime(), joinTime));
  const rangeEnd = new Date(Math.min(monthEnd.getTime(), today.getTime()));

  const attendanceByDate = new Map((attendance || []).map((r) => [new Date(r.date).toDateString(), r]));
  const leaveByDate = new Map(
    computeLeaveDayStatuses(dateOfJoining, leaves, month, year).map((d) => [d.date.toDateString(), d])
  );

  const rows = [];
  for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
    const date = new Date(d);
    const key = date.toDateString();
    const record = attendanceByDate.get(key);

    if (record) {
      rows.push({ kind: 'attendance', date, record });
    } else if (leaveByDate.has(key)) {
      rows.push({ kind: 'leave', date, day: leaveByDate.get(key) });
    } else if (date.getDay() === 0) {
      rows.push({ kind: 'holiday', date });
    } else {
      rows.push({ kind: 'absent', date });
    }
  }

  return rows.sort((a, b) => b.date - a.date);
};

// Rolls a set of buildMonthAttendanceRows() rows up into Present/Absent/Leave counts.
// `appliedFlexByDate` (optional) maps a date's toDateString() to hours applied that day.
export const summarizeMonthRows = (rows, appliedFlexByDate = {}) => {
  const flexFor = (date) => appliedFlexByDate[new Date(date).toDateString()] || 0;

  const presentCount = rows.filter(
    (r) => r.kind === 'attendance' && getDayStatus(r.record, r.date, flexFor(r.date)).className !== 'absent'
  ).length;
  const unpaidLeaveDays = rows.filter((r) => r.kind === 'leave' && !r.day.paid).length;
  const absentCount = rows.filter(
    (r) => r.kind === 'absent' || (r.kind === 'attendance' && getDayStatus(r.record, r.date, flexFor(r.date)).className === 'absent')
  ).length + unpaidLeaveDays;
  const leaveCount = rows.filter((r) => r.kind === 'leave' && r.day.paid).length;

  return { presentCount, absentCount, leaveCount };
};

// Computes Loss-of-Pay days for payroll from a set of buildMonthAttendanceRows() rows.
// A Half Day only costs half a day's pay; a full Absent (no check-in, or an unpaid
// leave day) costs a full day's pay. `breakdown` lists exactly which dates contributed
// and why, so the deduction can be explained to both the manager and the employee.
export const computeLopBreakdown = (rows, appliedFlexByDate = {}) => {
  const flexFor = (date) => appliedFlexByDate[new Date(date).toDateString()] || 0;
  const breakdown = [];

  rows.forEach((row) => {
    if (row.kind === 'absent') {
      breakdown.push({ date: row.date, type: 'absent', days: 1 });
      return;
    }
    if (row.kind === 'leave' && !row.day.paid) {
      breakdown.push({ date: row.date, type: 'unpaid-leave', days: 1 });
      return;
    }
    if (row.kind === 'attendance') {
      const status = getDayStatus(row.record, row.date, flexFor(row.date));
      if (status.className === 'absent') {
        breakdown.push({ date: row.date, type: 'absent', days: 1 });
      } else if (status.className === 'half-day') {
        breakdown.push({ date: row.date, type: 'half-day', days: 0.5 });
      }
    }
  });

  const lopDays = breakdown.reduce((sum, b) => sum + b.days, 0);
  return { lopDays, breakdown };
};
