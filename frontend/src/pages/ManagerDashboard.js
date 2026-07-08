import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { userAPI, attendanceAPI, leaveAPI, expenseAPI, resignationAPI } from '../services/api';
import './ManagerDashboard.css';

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const getSessionStatus = (record) => {
  if (!record) return { label: 'Not in yet', className: 'not-in' };

  const sessions = record.sessions && record.sessions.length > 0
    ? record.sessions
    : (record.checkInTime ? [{ checkInTime: record.checkInTime, checkOutTime: record.checkOutTime }] : []);
  const lastSession = sessions[sessions.length - 1];

  if (lastSession && !lastSession.checkOutTime) return { label: 'Checked in', className: 'checked-in' };
  if (record.checkInTime) return { label: 'Checked out', className: 'checked-out' };
  return { label: 'Not in yet', className: 'not-in' };
};

const ManagerDashboard = () => {
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [pendingResignations, setPendingResignations] = useState(0);
  const [teamFlexHours, setTeamFlexHours] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const [usersRes, attendanceRes, leavesRes, correctionsRes, expensesRes, resignationsRes] = await Promise.all([
        userAPI.getUsers(),
        attendanceAPI.getAttendance({ month, year }),
        leaveAPI.getLeaves(),
        attendanceAPI.getCorrectionRequests({}),
        expenseAPI.getExpenses(),
        resignationAPI.getResignations({})
      ]);

      setEmployees(usersRes.data.users || []);

      const allAttendance = attendanceRes.data.attendance || [];
      const todayRecords = allAttendance.filter(
        (record) => new Date(record.date).toDateString() === today.toDateString()
      );
      setTodayAttendance(todayRecords);

      const flexTotal = allAttendance
        .filter((record) => record.checkInTime && record.checkOutTime)
        .reduce((sum, record) => {
          const dayCap = new Date(record.date).getDay() === 6 ? 5 : 9;
          return sum + Math.max((record.hoursWorked || 0) - dayCap, 0);
        }, 0);
      setTeamFlexHours(flexTotal);

      const leaves = leavesRes.data.leaves || [];
      setPendingLeaves(leaves.filter((l) => l.status === 'pending').length);

      const corrections = correctionsRes.data.corrections || [];
      setPendingCorrections(corrections.filter((c) => c.status === 'pending').length);

      const expenses = expensesRes.data.expenses || [];
      setPendingClaims(expenses.filter((e) => e.status === 'submitted').length);

      const resignations = resignationsRes.data.resignations || [];
      setPendingResignations(resignations.filter((r) => r.status === 'pending').length);
    } catch (error) {
      console.error('Error loading team dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const findRecordFor = (employeeId) =>
    todayAttendance.find((r) => (r.employeeId?._id || r.employeeId) === employeeId);

  const checkedInCount = employees.filter(
    (emp) => getSessionStatus(findRecordFor(emp._id)).className === 'checked-in'
  ).length;

  const recentCutoff = new Date();
  recentCutoff.setHours(0, 0, 0, 0);
  recentCutoff.setDate(recentCutoff.getDate() - 2);

  const recentEmployees = [...employees]
    .filter((emp) => emp.createdAt && new Date(emp.createdAt) >= recentCutoff)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="manager-dashboard-page">
      <h1 className="page-title">Team Dashboard</h1>

      {loading ? (
        <p className="loading-text">Loading team overview...</p>
      ) : (
        <>
          <div className="stats-grid">
            <div className="stat-card" onClick={() => navigate('/team-attendance')}>
              <div className="stat-icon">👥</div>
              <h3>{checkedInCount}/{employees.length}</h3>
              <p>In today</p>
            </div>
            <div className="stat-card" onClick={() => navigate('/leave-approvals')}>
              <div className="stat-icon">☀️</div>
              <h3>{pendingLeaves}</h3>
              <p>Leave approvals</p>
            </div>
            <div className="stat-card" onClick={() => navigate('/correction-approvals')}>
              <div className="stat-icon">📋</div>
              <h3>{pendingCorrections}</h3>
              <p>Corrections</p>
            </div>
            <div className="stat-card" onClick={() => navigate('/payroll')}>
              <div className="stat-icon">💰</div>
              <h3>{pendingClaims}</h3>
              <p>Claims pending</p>
            </div>
            <div className="stat-card" onClick={() => navigate('/team-attendance?flexHours=true')}>
              <div className="stat-icon">⏱️</div>
              <h3>{teamFlexHours.toFixed(2)}</h3>
              <p>Flex hours</p>
            </div>
            <div className="stat-card" onClick={() => navigate('/resignation-approvals')}>
              <div className="stat-icon">🚪</div>
              <h3>{pendingResignations}</h3>
              <p>Resignations pending</p>
            </div>
          </div>

          <div className="team-card">
            <div className="team-card-header">
              <h2 className="section-title">Recently Added Employees</h2>
              <button type="button" className="add-field-btn" onClick={() => navigate('/employees')}>
                View all →
              </button>
            </div>
            {recentEmployees.length > 0 ? (
              <div className="team-list">
                {recentEmployees.map((emp) => (
                  <div key={emp._id} className="team-row" onClick={() => navigate('/employees')}>
                    <div className="team-avatar">
                      {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                    </div>
                    <div className="team-info">
                      <p className="team-name">{emp.firstName} {emp.lastName}</p>
                      <p className="team-role">{emp.designation}</p>
                    </div>
                    {emp.createdAt && <span className="team-added-date">Added {formatDate(emp.createdAt)}</span>}
                  </div>
                ))}
              </div>
            ) : (
              <p className="no-records">No employees added in the last 2 days</p>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default ManagerDashboard;
