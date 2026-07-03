import React, { useState, useEffect } from 'react';
import { attendanceAPI, userAPI } from '../services/api';
import './TeamAttendance.css';

const TeamAttendance = () => {
  const [employees, setEmployees] = useState([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (selectedEmployeeId) fetchAttendance();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedEmployeeId, selectedMonth, selectedYear]);

  const fetchEmployees = async () => {
    try {
      const response = await userAPI.getUsers();
      const list = response.data.users || [];
      setEmployees(list);
      if (list.length > 0) setSelectedEmployeeId(list[0]._id);
      else setLoading(false);
    } catch (error) {
      console.error('Error fetching employees:', error);
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      const response = await attendanceAPI.getAttendance({
        employeeId: selectedEmployeeId,
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

  const totalHours = attendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const presentDays = attendance.filter((r) => r.checkInTime).length;
  const selectedEmployee = employees.find((e) => e._id === selectedEmployeeId);

  return (
    <div className="team-attendance-page">
      <h1 className="page-title">Team Attendance</h1>

      <div className="picker-section">
        <div className="form-group">
          <label>Employee</label>
          <select value={selectedEmployeeId} onChange={(e) => setSelectedEmployeeId(e.target.value)}>
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
      </div>

      <div className="history-section">
        <div className="history-header">
          <h2 className="section-title">
            {selectedEmployee ? `${selectedEmployee.firstName} ${selectedEmployee.lastName}'s History` : 'History'}
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
  );
};

export default TeamAttendance;
