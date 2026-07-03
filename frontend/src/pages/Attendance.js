import React, { useState, useEffect } from 'react';
import { attendanceAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Attendance.css';

const Attendance = () => {
  const { user } = useAuth();
  const [attendance, setAttendance] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [correctionDate, setCorrectionDate] = useState(new Date().toISOString().split('T')[0]);
  const [correctionReason, setCorrectionReason] = useState('');
  const [submittingCorrection, setSubmittingCorrection] = useState(false);

  useEffect(() => {
    fetchAttendance();
    fetchCorrections();
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

  const handleCorrectionSubmit = async (e) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      alert('Please enter a reason');
      return;
    }

    try {
      setSubmittingCorrection(true);
      await attendanceAPI.requestCorrection({
        date: correctionDate,
        reason: correctionReason
      });
      alert('✅ Correction request submitted to manager');
      setCorrectionReason('');
      setCorrectionDate(new Date().toISOString().split('T')[0]);
      fetchCorrections();
    } catch (error) {
      alert('❌ Error: ' + (error.response?.data?.message || error.message));
    } finally {
      setSubmittingCorrection(false);
    }
  };

  const totalHours = attendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const presentDays = attendance.filter((r) => r.checkInTime).length;

  return (
    <div className="attendance-page">
      <h1 className="page-title">My Attendance</h1>

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
                <span><strong>{presentDays}</strong> days present</span>
              </div>
            )}
          </div>
          {loading ? (
            <p className="loading-text">Loading attendance...</p>
          ) : attendance.length > 0 ? (
            <div className="attendance-list">
              {attendance.map((record) => (
                <div key={record._id} className="attendance-entry">
                  <div className="attendance-row">
                    <div className="date-column">
                      <p className="date-label">{new Date(record.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                      <p className="work-mode">{record.workMode}</p>
                    </div>
                    <div className="time-column">
                      <p><span className="time-label">Check-in:</span> {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</p>
                      <p><span className="time-label">Check-out:</span> {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</p>
                    </div>
                    <div className="hours-column">
                      <p className="hours">{record.hoursWorked ? record.hoursWorked.toFixed(2) : 0} hrs</p>
                    </div>
                  </div>

                  {record.sessions && record.sessions.length > 1 && (
                    <div className="session-breakdown">
                      {record.sessions.map((s, idx) => (
                        <div key={idx} className="session-row">
                          <span className="session-label">Session {idx + 1}</span>
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
              ))}
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
