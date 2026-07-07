import { computeLeaveDayStatuses } from './leavePolicy';

// Saturdays are a half-day (5 hrs = full present, no separate half-day tier).
// Sundays are a company holiday when there's no actual check-in that day.
export const getDayStatus = (record, date) => {
  const dayOfWeek = new Date(date).getDay();
  const checkedIn = !!record?.checkInTime;

  if (!checkedIn) {
    if (dayOfWeek === 0) return { label: 'Holiday', className: 'holiday' };
    return { label: 'Absent', className: 'absent' };
  }

  // Checked in but not checked out yet (still working, or forgot to check out and
  // hasn't been corrected) — hours aren't final, so judge by check-in alone: present.
  if (!record.checkOutTime) {
    return { label: 'Present', className: 'present' };
  }

  const hours = record.hoursWorked || 0;
  const presentThreshold = dayOfWeek === 6 ? 5 : 9;
  if (hours >= presentThreshold) return { label: 'Present', className: 'present' };
  if (dayOfWeek !== 6 && hours >= 5) return { label: 'Half Day', className: 'half-day' };
  return { label: 'Absent', className: 'absent' };
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
export const summarizeMonthRows = (rows) => {
  const presentCount = rows.filter(
    (r) => r.kind === 'attendance' && getDayStatus(r.record, r.date).className !== 'absent'
  ).length;
  const unpaidLeaveDays = rows.filter((r) => r.kind === 'leave' && !r.day.paid).length;
  const absentCount = rows.filter(
    (r) => r.kind === 'absent' || (r.kind === 'attendance' && getDayStatus(r.record, r.date).className === 'absent')
  ).length + unpaidLeaveDays;
  const leaveCount = rows.filter((r) => r.kind === 'leave' && r.day.paid).length;

  return { presentCount, absentCount, leaveCount };
};
