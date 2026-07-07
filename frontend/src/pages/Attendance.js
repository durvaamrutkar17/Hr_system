import React, { useState, useEffect } from 'react';
import { attendanceAPI, leaveAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { buildMonthAttendanceRows, getDayStatus, summarizeMonthRows } from '../utils/attendanceCalendar';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './Attendance.css';

const Attendance = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [correctionDate, setCorrectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [correctionCheckIn, setCorrectionCheckIn] = useState('');
  const [correctionCheckOut, setCorrectionCheckOut] = useState('');
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);
  const { message, showToast } = useToast();

  useEffect(() => {
    fetchAttendance();
    fetchCorrections();
    fetchLeaves();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedYear]);

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getAttendance({
        employeeId: user._id,
        month: selectedMonth,
        year: selectedYear
      });
      setAttendance(response.data.attendance || []);
    } catch (error) {
      console.error('Error fetching attendance:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCorrections = async () => {
    try {
      const response = await attendanceAPI.getCorrectionRequests({ employeeId: user._id });
      setCorrections(response.data.corrections || []);
    } catch (error) {
      console.error('Error fetching correction requests:', error);
    }
  };

  const fetchLeaves = async () => {
    try {
      const response = await leaveAPI.getEmployeeLeaves(user._id);
      setLeaves(response.data.leaves || []);
    } catch (error) {
      console.error('Error fetching leaves:', error);
    }
  };

  // Combines the picked date + "HH:MM" into a real Date in the browser's own timezone
  // (the employee's actual local time) rather than leaving the server to guess it.
  const combineLocalDateTime = (dateStr, timeStr) => {
    if (!timeStr) return undefined;
    const [year, month, day] = dateStr.split('-').map(Number);
    const [hours, minutes] = timeStr.split(':').map(Number);
    return new Date(year, month - 1, day, hours, minutes, 0, 0).toISOString();
  };

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      showToast('error', 'Please enter a reason');
      return;
    }
    if (!correctionCheckIn && !correctionCheckOut) {
      showToast('error', 'Enter the correct check-in time, check-out time, or both');
      return;
    }

    try {
      setSubmittingCorrection(true);
      await attendanceAPI.requestCorrection({
        date: correctionDate,
        reason: correctionReason,
        checkInTime: combineLocalDateTime(correctionDate, correctionCheckIn),
        checkOutTime: combineLocalDateTime(correctionDate, correctionCheckOut)
      });
      showToast('success', 'Correction request submitted to manager');
      setCorrectionReason('');
      setCorrectionCheckIn('');
      setCorrectionCheckOut('');
      setCorrectionDate(new Date().toISOString().split('T')[0]);
      fetchCorrections();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const rows = buildMonthAttendanceRows({
    dateOfJoining: user?.dateOfJoining,
    attendance,
    leaves,
    month: selectedMonth,
    year: selectedYear
  });

  const totalHours = attendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

  const { presentCount, absentCount, leaveCount } = summarizeMonthRows(rows);

  return (
    <div className="attendance-page">
      <h1 className="page-title">My Attendance</h1>

      <Toast message={message} />

      <div className="attendance-stats">
        <div className="stat-card">
          <p className="stat-label">Present</p>
          <h3 className="stat-value">{presentCount}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Absent</p>
          <h3 className="stat-value">{absentCount}</h3>
        </div>
        <div className="stat-card">
          <p className="stat-label">Leave</p>
          <h3 className="stat-value">{leaveCount}</h3>
        </div>
      </div>

      <div className="attendance-content">
        {/* Correction Request Section */}
        <div className="correction-section">
          <h2 className="section-title">Request a correction</h2>
          <form onSubmit={handleCorrectionSubmit} className="correction-form">
            <div className="form-group">
              <label>Date</label>
              <input
                type="date"
                value={correctionDate}
                onChange={(e) => setCorrectionDate(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Correct check-in</label>
              <input
                type="time"
                value={correctionCheckIn}
                onChange={(e) => setCorrectionCheckIn(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Correct check-out</label>
              <input
                type="time"
                value={correctionCheckOut}
                onChange={(e) => setCorrectionCheckOut(e.target.value)}
              />
            </div>
            <div className="form-group reason-group">
              <label>Reason</label>
              <input
                type="text"
                placeholder="e.g. Forgot to check out"
                value={correctionReason}
                onChange={(e) => setCorrectionReason(e.target.value)}
              />
            </div>
            <button
              type="submit"
              className="submit-btn"
              disabled={submittingCorrection}
            >
              {submittingCorrection ? 'Submitting...' : 'Submit to manager'}
            </button>
          </form>
        </div>

        {/* Correction Requests Status */}
        {corrections.length > 0 && (
          <div className="correction-requests-section">
            <h2 className="section-title">Correction Requests</h2>
            <div className="correction-list">
              {corrections.map((c) => (
                <div key={c._id} className="correction-row">
                  <div className="date-column">
                    <p className="date-label">
                      {new Date(c.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    <p className="correction-reason">{c.reason}</p>
                    <p className="correction-reason">
                      {c.requestedCheckInTime ? new Date(c.requestedCheckInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                      {' – '}
                      {c.requestedCheckOutTime ? new Date(c.requestedCheckOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                    </p>
                  </div>
                  <span className={`status-badge ${c.status}`}>{c.status}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Month/Year Selector */}
        <div className="month-selector">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(m => (
              <option key={m} value={m}>
                {new Date(2000, m - 1).toLocaleString('en-US', { month: 'long' })}
              </option>
            ))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value))}>
            {[2023, 2024, 2025, 2026].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        {/* History Section */}
        <div className="history-section">
          <div className="history-header">
            <h2 className="section-title">History</h2>
            {!loading && attendance.length > 0 && (
              <div className="history-summary">
                <span><strong>{totalHours.toFixed(2)}</strong> hrs total</span>
                <span><strong>{presentCount}</strong> days present</span>
              </div>
            )}
          </div>
          {loading ? (
            <p className="loading-text">Loading attendance...</p>
          ) : rows.length > 0 ? (
            <div className="table-wrapper">
              <table className="attendance-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Check-in</th>
                    <th>Check-out</th>
                    <th>Working Hours</th>
                    <th>Flex Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    if (row.kind === 'holiday') {
                      return (
                        <tr key={`holiday-${row.date.toISOString()}`} className="attendance-table-row">
                          <td><p className="date-label">{row.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p></td>
                          <td><span className="status-badge holiday">Holiday</span></td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                        </tr>
                      );
                    }

                    if (row.kind === 'absent') {
                      return (
                        <tr key={`absent-${row.date.toISOString()}`} className="attendance-table-row">
                          <td><p className="date-label">{row.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p></td>
                          <td><span className="status-badge absent">Absent</span></td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                          <td>-</td>
                        </tr>
                      );
                    }

                    if (row.kind === 'leave') {
                      const status = row.day.paid
                        ? { label: 'Leave', className: 'leave' }
                        : { label: 'Absent', className: 'absent' };
                      return (
                        <tr key={`leave-${row.day.leaveId}-${row.date.toISOString()}`} className="attendance-table-row">
                          <td><p className="date-label">{row.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p></td>
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
                    const workingHours = Math.min(hours, 9);
                    const flexHours = Math.max(hours - 9, 0);
                    const status = getDayStatus(record, row.date);

                    return (
                      <React.Fragment key={record._id}>
                        <tr className="attendance-table-row">
                          <td>
                            <p className="date-label">{row.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                            <p className="work-mode">{record.workMode}</p>
                          </td>
                          <td><span className={`status-badge ${status.className}`}>{status.label}</span></td>
                          <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                          <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                          <td>{workingHours.toFixed(2)} hrs</td>
                          <td>{flexHours > 0 ? `${flexHours.toFixed(2)} hrs` : '-'}</td>
                        </tr>
                        {record.sessions && record.sessions.length > 1 && (
                          <tr className="session-breakdown-row">
                            <td colSpan={6}>
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
              <p>No attendance records for this month</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Attendance;
