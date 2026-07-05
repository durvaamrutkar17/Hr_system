import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, attendanceAPI, leaveAPI, expenseAPI } from '../services/api';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './ManagerDashboard.css';

const emptyEmployeeForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  designation: '',
  department: '',
  dateOfJoining: new Date().toISOString().split('T')[0],
  role: 'employee'
};

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState(0);
  const [pendingCorrections, setPendingCorrections] = useState(0);
  const [pendingClaims, setPendingClaims] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeAttendance, setEmployeeAttendance] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const { message, showToast } = useToast();

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const [usersRes, attendanceRes, leavesRes, correctionsRes, expensesRes] = await Promise.all([
        userAPI.getUsers(),
        attendanceAPI.getAttendance({ month, year }),
        leaveAPI.getLeaves(),
        attendanceAPI.getCorrectionRequests({}),
        expenseAPI.getExpenses()
      ]);

      setEmployees(usersRes.data.users || []);

      const allAttendance = attendanceRes.data.attendance || [];
      const todayRecords = allAttendance.filter(
        (record) => new Date(record.date).toDateString() === today.toDateString()
      );
      setTodayAttendance(todayRecords);

      const leaves = leavesRes.data.leaves || [];
      setPendingLeaves(leaves.filter((l) => l.status === 'pending').length);

      const corrections = correctionsRes.data.corrections || [];
      setPendingCorrections(corrections.filter((c) => c.status === 'pending').length);

      const expenses = expensesRes.data.expenses || [];
      setPendingClaims(expenses.filter((e) => e.status === 'submitted').length);
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

  const handleEmployeeFormChange = (e) => {
    const { name, value } = e.target;
    setEmployeeForm((prev) => ({ ...prev, [name]: value }));
  };

  const openEmployeeDetail = async (emp) => {
    setSelectedEmployee(emp);
    setEmployeeAttendance([]);
    try {
      setLoadingDetail(true);
      const today = new Date();
      const response = await attendanceAPI.getAttendance({
        employeeId: emp._id,
        month: today.getMonth() + 1,
        year: today.getFullYear()
      });
      setEmployeeAttendance(response.data.attendance || []);
    } catch (error) {
      console.error('Error loading employee attendance:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleAddEmployee = async (e) => {
    e.preventDefault();

    if (employeeForm.password.length < 6) {
      showToast('error', 'Password must be at least 6 characters');
      return;
    }

    try {
      setAddingEmployee(true);
      await userAPI.createEmployee(employeeForm);
      showToast('success', 'Employee added');
      setShowAddModal(false);
      setEmployeeForm(emptyEmployeeForm);
      fetchAll();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setAddingEmployee(false);
    }
  };

  return (
    <div className="manager-dashboard-page">
      <h1 className="page-title">Team Dashboard</h1>

      <Toast message={message} />

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
          </div>

          <div className="team-card">
            <div className="team-card-header">
              <h2 className="section-title">Team</h2>
              <button className="add-employee-btn" onClick={() => setShowAddModal(true)}>
                + Add Employee
              </button>
            </div>
            <div className="team-list">
              {employees.map((emp) => {
                const status = getSessionStatus(findRecordFor(emp._id));
                return (
                  <div key={emp._id} className="team-row" onClick={() => openEmployeeDetail(emp)}>
                    <div className="team-avatar">
                      {emp.firstName?.charAt(0)}{emp.lastName?.charAt(0)}
                    </div>
                    <div className="team-info">
                      <p className="team-name">
                        {emp.firstName} {emp.lastName}{emp._id === user._id ? ' (You)' : ''}
                      </p>
                      <p className="team-role">{emp.designation}</p>
                    </div>
                    <span className={`team-status ${status.className}`}>{status.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add Employee</h2>
            <form onSubmit={handleAddEmployee} className="modal-form">
              <div className="modal-row">
                <div className="modal-group">
                  <label>First Name</label>
                  <input type="text" name="firstName" value={employeeForm.firstName} onChange={handleEmployeeFormChange} required />
                </div>
                <div className="modal-group">
                  <label>Last Name</label>
                  <input type="text" name="lastName" value={employeeForm.lastName} onChange={handleEmployeeFormChange} required />
                </div>
              </div>

              <div className="modal-group">
                <label>Email</label>
                <input type="email" name="email" value={employeeForm.email} onChange={handleEmployeeFormChange} required />
              </div>

              <div className="modal-row">
                <div className="modal-group">
                  <label>Temporary Password</label>
                  <input type="password" name="password" value={employeeForm.password} onChange={handleEmployeeFormChange} placeholder="Min 6 characters" required />
                </div>
                <div className="modal-group">
                  <label>Phone</label>
                  <input type="tel" name="phone" value={employeeForm.phone} onChange={handleEmployeeFormChange} required />
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-group">
                  <label>Designation</label>
                  <input type="text" name="designation" value={employeeForm.designation} onChange={handleEmployeeFormChange} placeholder="e.g. Software Engineer" required />
                </div>
                <div className="modal-group">
                  <label>Department</label>
                  <select name="department" value={employeeForm.department} onChange={handleEmployeeFormChange} required>
                    <option value="">Select Department</option>
                    <option value="Engineering">Engineering</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Sales">Sales</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Operations">Operations</option>
                  </select>
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-group">
                  <label>Date of Joining</label>
                  <input type="date" name="dateOfJoining" value={employeeForm.dateOfJoining} onChange={handleEmployeeFormChange} required />
                </div>
                <div className="modal-group">
                  <label>Role</label>
                  <select name="role" value={employeeForm.role} onChange={handleEmployeeFormChange}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-cancel-btn" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="modal-submit-btn" disabled={addingEmployee}>
                  {addingEmployee ? 'Adding...' : 'Add Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedEmployee && (
        <div className="modal-overlay" onClick={() => setSelectedEmployee(null)}>
          <div className="modal-card detail-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="detail-header">
              <div className="detail-avatar">
                {selectedEmployee.firstName?.charAt(0)}{selectedEmployee.lastName?.charAt(0)}
              </div>
              <div>
                <h2 className="detail-name">
                  {selectedEmployee.firstName} {selectedEmployee.lastName}
                  {selectedEmployee._id === user._id ? ' (You)' : ''}
                </h2>
                <p className="detail-role">{selectedEmployee.designation} · {selectedEmployee.department}</p>
              </div>
              <span className={`role-badge ${selectedEmployee.role}`}>{selectedEmployee.role}</span>
            </div>

            <div className="detail-section">
              <div className="detail-grid">
                <div className="detail-field">
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{selectedEmployee.email}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Phone</p>
                  <p className="detail-value">{selectedEmployee.phone || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Date of Joining</p>
                  <p className="detail-value">
                    {selectedEmployee.dateOfJoining
                      ? new Date(selectedEmployee.dateOfJoining).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })
                      : '—'}
                  </p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Work Mode</p>
                  <p className="detail-value">{selectedEmployee.workMode || '—'}</p>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">Leave balance</h3>
              <div className="detail-grid">
                <div className="detail-field">
                  <p className="detail-label">Casual</p>
                  <p className="detail-value">{selectedEmployee.casualLeaveBalance ?? '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Sick</p>
                  <p className="detail-value">{selectedEmployee.sickLeaveBalance ?? '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Earned</p>
                  <p className="detail-value">{selectedEmployee.earnedLeaveBalance ?? '—'}</p>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">This month's attendance</h3>
              {loadingDetail ? (
                <p className="loading-text">Loading...</p>
              ) : (
                <div className="detail-grid">
                  <div className="detail-field">
                    <p className="detail-label">Hours logged</p>
                    <p className="detail-value">
                      {employeeAttendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0).toFixed(2)} hrs
                    </p>
                  </div>
                  <div className="detail-field">
                    <p className="detail-label">Days present</p>
                    <p className="detail-value">
                      {employeeAttendance.filter((r) => r.checkInTime).length}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="modal-cancel-btn" onClick={() => setSelectedEmployee(null)}>
                Close
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={() => navigate('/team-attendance')}
              >
                View full attendance
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagerDashboard;
