import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { attendanceAPI, userAPI, leaveAPI } from '../services/api';
import { buildMonthAttendanceRows, getDayStatus } from '../utils/attendanceCalendar';
import './TeamAttendance.css';

const TeamAttendance = () => {
  const location = useLocation();
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedDate, setSelectedDate] = useState('');
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    fetchEmployees();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) {
      fetchAttendance();
      fetchLeaves();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, selectedMonth, selectedYear]);

  const fetchEmployees = async () => {
    try {
      const response = await userAPI.getUsers();
      const list = response.data.users || [];
      setEmployees(list);

      const requestedId = new URLSearchParams(location.search).get('employeeId');
      if (requestedId && list.some((emp) => emp._id === requestedId)) {
        setSelectedEmployeeId(requestedId);
      } else if (list.length > 0) {
        setSelectedEmployeeId(list[0]._id);
      } else {
        setLoading(false);
      }
    } catch (error) {
      console.error('Error fetching employees:', error);
      setLoading(false);
    }
  };

  const isAllSelected = selectedEmployeeId === 'all';

  const handleDateChange = (value) => {
    setSelectedDate(value);
    if (value) {
      const [y, m] = value.split('-').map(Number);
      setSelectedMonth(m);
      setSelectedYear(y);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const params = { month: selectedMonth, year: selectedYear };
      if (!isAllSelected) params.employeeId = selectedEmployeeId;
      const response = await attendanceAPI.getAttendance(params);
      setAttendance(response.data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaves = async () => {
    try {
      const response = isAllSelected
        ? await leaveAPI.getLeaves()
        : await leaveAPI.getEmployeeLeaves(selectedEmployeeId);
      setLeaves(response.data.leaves || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  const toggleRowDetail = (key) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const totalHours = attendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const presentDays = attendance.filter((r) => r.checkInTime).length;
  const selectedEmployee = employees.find((e) => e._id === selectedEmployeeId);

  const employeesToShow = isAllSelected ? employees : selectedEmployee ? [selectedEmployee] : [];

  const attendanceByEmployee = attendance.reduce((acc, r) => {
    const empId = r.employeeId?._id || r.employeeId;
    (acc[empId] = acc[empId] || []).push(r);
    return acc;
  }, {});
  const leavesByEmployee = leaves.reduce((acc, l) => {
    const empId = l.employeeId?._id || l.employeeId;
    (acc[empId] = acc[empId] || []).push(l);
    return acc;
  }, {});

  const combinedRows = employeesToShow.flatMap((emp) =>
    buildMonthAttendanceRows({
      dateOfJoining: emp.dateOfJoining,
      attendance: attendanceByEmployee[emp._id] || [],
      leaves: leavesByEmployee[emp._id] || [],
      month: selectedMonth,
      year: selectedYear
    }).map((row) => ({ ...row, employee: emp }))
  ).sort((a, b) => b.date - a.date);

  const displayedRows = selectedDate
    ? combinedRows.filter((row) => {
        const [y, m, d] = selectedDate.split('-').map(Number);
        return row.date.getFullYear() === y && row.date.getMonth() + 1 === m && row.date.getDate() === d;
      })
    : combinedRows;

  return (
    <div className="team-attendance-page">
      <h1 className="page-title">Team Attendance</h1>

      <div className="picker-section">
        <div className="form-group">
          <label>Employee</label>
          <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
            <option value="all">All Employees</option>
            {employees.map((emp) => (
              <option key={emp._id} value={emp._id}>
                {emp.firstName} {emp.lastName} — {emp.designation}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Month</label>
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleString('en-US', { month: 'long' })}
              </option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Year</label>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
            {[2023, 2024, 2025, 2026].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div className="form-group">
          <label>Date</label>
          <input type="date" value={selectedDate} onChange={(e) => handleDateChange(e.target.value)} />
          {selectedDate && (
            <button type="button" className="clear-date-btn" onClick={() => setSelectedDate('')}>
              Clear
            </button>
          )}
        </div>
      </div>

      <div className="history-section">
        <div className="history-header">
          <h2 className="section-title">
            {isAllSelected
              ? "All Employees' History"
              : selectedEmployee
              ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}'s History`
              : 'History'}
          </h2>
          {!loading && attendance.length > 0 && (
            <div className="history-summary">
              <span><strong>{totalHours.toFixed(2)}</strong> hrs total</span>
              <span><strong>{presentDays}</strong> days present</span>
            </div>
          )}
        </div>

        {loading ? (
          <p className="loading-text">Loading attendance...</p>
        ) : displayedRows.length > 0 ? (
          <div className="table-wrapper">
            <table className="attendance-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Employee</th>
                  <th>Status</th>
                  <th>Check-in</th>
                  <th>Check-out</th>
                  <th>Working Hours</th>
                  <th>Flex Hours</th>
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row) => {
                  const employeeName = row.employee ? `${row.employee.firstName} ${row.employee.lastName}` : '-';

                  if (row.kind === 'holiday') {
                    return (
                      <tr key={`holiday-${row.employee._id}-${row.date.toISOString()}`} className="attendance-table-row">
                        <td><p className="date-label">{row.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p></td>
                        <td>{employeeName}</td>
                        <td><span className="status-badge holiday">Holiday</span></td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                      </tr>
                    );
                  }

                  if (row.kind === 'absent') {
                    const rowKey = `absent-${row.employee._id}-${row.date.toISOString()}`;
                    return (
                      <React.Fragment key={rowKey}>
                        <tr className="attendance-table-row">
                          <td><p className="date-label">{row.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p></td>
                          <td>{employeeName}</td>
                          <td>
                            <div className="status-cell">
                              <span className="status-badge absent">Absent</span>
                              <button
                                type="button"
                                className="status-info-btn"
                                onClick={() => toggleRowDetail(rowKey)}
                                aria-label="View calculation"
                              >
                                i
                              </button>
                            </div>
                          </td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                        </tr>
                        {expandedRows.has(rowKey) && (
                          <tr className="detail-breakdown-row">
                            <td colSpan={7}>
                              <div className="detail-breakdown">
                                <p className="status-detail">No check-in recorded</p>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  }

                  if (row.kind === 'leave') {
                    const status = row.day.paid
                      ? { label: 'Leave', className: 'leave' }
                      : { label: 'Absent', className: 'absent' };
                    return (
                      <tr key={`leave-${row.day.leaveId}-${row.date.toISOString()}`} className="attendance-table-row">
                        <td>
                          <p className="date-label">{row.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                        </td>
                        <td>{employeeName}</td>
                        <td><span className={`status-badge ${status.className}`}>{status.label}</span></td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                        <td>-</td>
                      </tr>
                    );
                  }

                  const record = row.record;
                  const hours = record.hoursWorked || 0;
                  const dayCap = row.date.getDay() === 6 ? 5 : 9;
                  const workingHours = Math.min(hours, dayCap);
                  const flexHours = Math.max(hours - dayCap, 0);
                  const status = getDayStatus(record, row.date);
                  const hasSessions = record.sessions && record.sessions.length > 1;
                  const isExpanded = expandedRows.has(record._id);

                  return (
                    <React.Fragment key={record._id}>
                      <tr className="attendance-table-row">
                        <td>
                          <p className="date-label">{row.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          <p className="work-mode">{record.workMode}</p>
                        </td>
                        <td>{employeeName}</td>
                        <td>
                          <div className="status-cell">
                            <span className={`status-badge ${status.className}`}>{status.label}</span>
                            <button
                              type="button"
                              className="status-info-btn"
                              onClick={() => toggleRowDetail(record._id)}
                              aria-label="View calculation"
                            >
                              i
                            </button>
                          </div>
                        </td>
                        <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                        <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                        <td>{workingHours.toFixed(2)} hrs</td>
                        <td>{flexHours > 0 ? `${flexHours.toFixed(2)} hrs` : '-'}</td>
                      </tr>
                      {isExpanded && (
                        <tr className="detail-breakdown-row">
                          <td colSpan={7}>
                            <div className="detail-breakdown">
                              {status.detail && <p className="status-detail">{status.detail}</p>}
                              {hasSessions && (
                                <div className="session-breakdown">
                                  {record.sessions.map((s, idx) => (
                                    <div key={idx} className="session-row">
                                      <span className="session-label">Session {idx + 1}</span>
                                      {s.workMode && <span className="session-mode">{s.workMode}</span>}
                                      <span className="session-time">
                                        {s.checkInTime ? new Date(s.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                                        {' – '}
                                        {s.checkOutTime ? new Date(s.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : 'ongoing'}
                                      </span>
                                      {s.reason && <span className="session-reason">{s.reason}</span>}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="no-records">
            <p>No attendance records for {selectedDate ? 'this date' : 'this month'}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default TeamAttendance;
