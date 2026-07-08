import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, attendanceAPI, leaveAPI, expenseAPI, documentAPI, payslipAPI, FILE_BASE_URL } from '../services/api';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import PasswordInput from '../components/PasswordInput';
import { validateEmployeeForm } from '../utils/formValidation';
import './ManagerDashboard.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const emptyEmployeeForm = {
  firstName: '',
  lastName: '',
  email: '',
  password: '',
  phone: '',
  designation: '',
  department: '',
  dateOfJoining: new Date().toISOString().split('T')[0],
  role: 'employee',
  workMode: 'WFO',
  salaryStructure: {
    basic: 0,
    hra: 0,
    specialAllowance: 0,
    professionalTax: 0,
    tds: 0
  }
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

const Employees = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [employees, setEmployees] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [employeeForm, setEmployeeForm] = useState(emptyEmployeeForm);
  const [employeeFormErrors, setEmployeeFormErrors] = useState({});
  const [addingEmployee, setAddingEmployee] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeAttendance, setEmployeeAttendance] = useState([]);
  const [employeeLeaves, setEmployeeLeaves] = useState([]);
  const [employeeCorrections, setEmployeeCorrections] = useState([]);
  const [employeeExpenses, setEmployeeExpenses] = useState([]);
  const [employeeDocuments, setEmployeeDocuments] = useState([]);
  const [employeeLatestPayslip, setEmployeeLatestPayslip] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [customSalaryFields, setCustomSalaryFields] = useState([]);
  const [addingField, setAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const { message, showToast } = useToast();

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const [usersRes, attendanceRes] = await Promise.all([
        userAPI.getUsers(),
        attendanceAPI.getAttendance({ month, year })
      ]);

      setEmployees(usersRes.data.users || []);

      const allAttendance = attendanceRes.data.attendance || [];
      const todayRecords = allAttendance.filter(
        (record) => new Date(record.date).toDateString() === today.toDateString()
      );
      setTodayAttendance(todayRecords);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setEmployeeForm(emptyEmployeeForm);
    setEmployeeFormErrors({});
  };

  const findRecordFor = (employeeId) =>
    todayAttendance.find((r) => (r.employeeId?._id || r.employeeId) === employeeId);

  const filteredEmployees = employees.filter((emp) => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return true;
    return (
      `${emp.firstName} ${emp.lastName}`.toLowerCase().includes(query) ||
      emp.designation?.toLowerCase().includes(query) ||
      emp.department?.toLowerCase().includes(query)
    );
  });

  const handleEmployeeFormChange = (e) => {
    const { name, value } = e.target;
    setEmployeeForm((prev) => ({ ...prev, [name]: value }));
    setEmployeeFormErrors((prev) => (prev[name] ? { ...prev, [name]: undefined } : prev));
  };

  const handleSalaryFieldChange = (field, value) => {
    const sanitized = value === '' ? '' : (Number.isNaN(parseInt(value, 10)) ? '' : String(Math.max(0, parseInt(value, 10))));
    setEmployeeForm((prev) => ({
      ...prev,
      salaryStructure: { ...prev.salaryStructure, [field]: sanitized }
    }));
  };

  const openEmployeeDetail = async (emp) => {
    setSelectedEmployee(emp);
    setEmployeeAttendance([]);
    setEmployeeLeaves([]);
    setEmployeeCorrections([]);
    setEmployeeExpenses([]);
    setEmployeeDocuments([]);
    setEmployeeLatestPayslip(null);
    setCustomSalaryFields([]);
    setAddingField(false);
    setNewFieldName('');
    try {
      setLoadingDetail(true);
      const today = new Date();
      const month = today.getMonth() + 1;
      const year = today.getFullYear();

      const [attendanceRes, leavesRes, correctionsRes, expensesRes, documentsRes, payslipsRes] = await Promise.all([
        attendanceAPI.getAttendance({ employeeId: emp._id, month, year }),
        leaveAPI.getEmployeeLeaves(emp._id),
        attendanceAPI.getCorrectionRequests({ employeeId: emp._id }),
        expenseAPI.getExpenses({ employeeId: emp._id }),
        documentAPI.getDocuments({ employeeId: emp._id }),
        payslipAPI.getPayslips({ employeeId: emp._id })
      ]);

      setEmployeeAttendance(attendanceRes.data.attendance || []);
      setEmployeeLeaves(leavesRes.data.leaves || []);
      setEmployeeCorrections(correctionsRes.data.corrections || []);
      setEmployeeExpenses(expensesRes.data.expenses || []);
      setEmployeeDocuments(documentsRes.data.documents || []);
      setEmployeeLatestPayslip((payslipsRes.data.payslips || [])[0] || null);
    } catch (error) {
      console.error('Error loading employee detail:', error);
    } finally {
      setLoadingDetail(false);
    }
  };

  const closeEmployeeDetail = () => setSelectedEmployee(null);

  const handleConfirmAddField = (e) => {
    e.preventDefault();
    if (!newFieldName.trim()) return;
    setCustomSalaryFields((prev) => [...prev, { id: Date.now(), name: newFieldName.trim(), value: '' }]);
    setNewFieldName('');
    setAddingField(false);
  };

  const handleCancelAddField = () => {
    setAddingField(false);
    setNewFieldName('');
  };

  const handleCustomFieldValueChange = (id, value) => {
    setCustomSalaryFields((prev) => prev.map((field) => (field.id === id ? { ...field, value } : field)));
  };

  const employeeHoursLogged = employeeAttendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);
  const employeeDaysPresent = employeeAttendance.filter((r) => r.checkInTime).length;
  const employeeFlexHours = employeeAttendance.reduce((sum, r) => sum + Math.max((r.hoursWorked || 0) - 9, 0), 0);

  const recentLeaves = [...employeeLeaves]
    .sort((a, b) => new Date(b.startDate) - new Date(a.startDate))
    .slice(0, 5);
  const recentCorrections = [...employeeCorrections]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  const recentExpenses = [...employeeExpenses]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 5);
  const recentDocuments = employeeDocuments.slice(0, 5);

  const handleAddEmployee = async (e) => {
    e.preventDefault();

    const errors = validateEmployeeForm(employeeForm);
    setEmployeeFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      showToast('error', 'Please fix the highlighted fields');
      return;
    }

    try {
      setAddingEmployee(true);
      await userAPI.createEmployee({
        ...employeeForm,
        salaryStructure: {
          basic: Number(employeeForm.salaryStructure.basic) || 0,
          hra: Number(employeeForm.salaryStructure.hra) || 0,
          specialAllowance: Number(employeeForm.salaryStructure.specialAllowance) || 0,
          professionalTax: Number(employeeForm.salaryStructure.professionalTax) || 0,
          tds: Number(employeeForm.salaryStructure.tds) || 0
        }
      });
      showToast('success', 'Employee added');
      setShowAddModal(false);
      setEmployeeForm(emptyEmployeeForm);
      setEmployeeFormErrors({});
      fetchEmployees();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setAddingEmployee(false);
    }
  };

  return (
    <div className="manager-dashboard-page">
      <h1 className="page-title">Employees</h1>

      <Toast message={message} />

      <div className="team-card">
        <div className="team-card-header">
          <h2 className="section-title">Team</h2>
          <div className="team-header-actions">
            <input
              type="text"
              className="team-search-input"
              placeholder="Search employees..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            <button className="add-employee-btn" onClick={() => setShowAddModal(true)}>
              + Add Employee
            </button>
          </div>
        </div>
        {loading ? (
          <p className="loading-text">Loading team...</p>
        ) : filteredEmployees.length > 0 ? (
          <div className="team-list">
            {filteredEmployees.map((emp) => {
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
        ) : (
          <p className="no-records">No employees match "{searchQuery}"</p>
        )}
      </div>

      {showAddModal && (
        <div className="modal-overlay" onClick={closeAddModal}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <h2 className="modal-title">Add Employee</h2>
            <form onSubmit={handleAddEmployee} className="modal-form" noValidate>
              <div className="modal-row">
                <div className="modal-group">
                  <label>First Name</label>
                  <input type="text" name="firstName" value={employeeForm.firstName} onChange={handleEmployeeFormChange} className={employeeFormErrors.firstName ? 'input-error' : ''} />
                  {employeeFormErrors.firstName && <p className="field-error">{employeeFormErrors.firstName}</p>}
                </div>
                <div className="modal-group">
                  <label>Last Name</label>
                  <input type="text" name="lastName" value={employeeForm.lastName} onChange={handleEmployeeFormChange} className={employeeFormErrors.lastName ? 'input-error' : ''} />
                  {employeeFormErrors.lastName && <p className="field-error">{employeeFormErrors.lastName}</p>}
                </div>
              </div>

              <div className="modal-group">
                <label>Email</label>
                <input type="email" name="email" value={employeeForm.email} onChange={handleEmployeeFormChange} className={employeeFormErrors.email ? 'input-error' : ''} />
                {employeeFormErrors.email && <p className="field-error">{employeeFormErrors.email}</p>}
              </div>

              <div className="modal-row">
                <div className="modal-group">
                  <label>Temporary Password</label>
                  <PasswordInput name="password" value={employeeForm.password} onChange={handleEmployeeFormChange} placeholder="Min 6 characters" className={employeeFormErrors.password ? 'input-error' : ''} />
                  {employeeFormErrors.password && <p className="field-error">{employeeFormErrors.password}</p>}
                </div>
                <div className="modal-group">
                  <label>Phone</label>
                  <input type="tel" name="phone" value={employeeForm.phone} onChange={handleEmployeeFormChange} className={employeeFormErrors.phone ? 'input-error' : ''} />
                  {employeeFormErrors.phone && <p className="field-error">{employeeFormErrors.phone}</p>}
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-group">
                  <label>Designation</label>
                  <input type="text" name="designation" value={employeeForm.designation} onChange={handleEmployeeFormChange} placeholder="e.g. Software Engineer" className={employeeFormErrors.designation ? 'input-error' : ''} />
                  {employeeFormErrors.designation && <p className="field-error">{employeeFormErrors.designation}</p>}
                </div>
                <div className="modal-group">
                  <label>Department</label>
                  <select name="department" value={employeeForm.department} onChange={handleEmployeeFormChange} className={employeeFormErrors.department ? 'input-error' : ''}>
                    <option value="">Select Department</option>
                    <option value="Engineering">Engineering</option>
                    <option value="HR">HR</option>
                    <option value="Finance">Finance</option>
                    <option value="Sales">Sales</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Operations">Operations</option>
                  </select>
                  {employeeFormErrors.department && <p className="field-error">{employeeFormErrors.department}</p>}
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-group">
                  <label>Date of Joining</label>
                  <input type="date" name="dateOfJoining" value={employeeForm.dateOfJoining} onChange={handleEmployeeFormChange} className={employeeFormErrors.dateOfJoining ? 'input-error' : ''} />
                  {employeeFormErrors.dateOfJoining && <p className="field-error">{employeeFormErrors.dateOfJoining}</p>}
                </div>
                <div className="modal-group">
                  <label>Role</label>
                  <select name="role" value={employeeForm.role} onChange={handleEmployeeFormChange}>
                    <option value="employee">Employee</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>

              <div className="modal-row">
                <div className="modal-group">
                  <label>Work Mode</label>
                  <select name="workMode" value={employeeForm.workMode} onChange={handleEmployeeFormChange}>
                    <option value="WFO">WFO (Office)</option>
                    <option value="WFH">WFH (Remote)</option>
                    <option value="Hybrid">Hybrid</option>
                  </select>
                </div>
              </div>

              <p className="modal-section-label">Salary structure</p>
              <div className="structure-form">
                <div className="structure-group">
                  <label>Basic</label>
                  <input
                    type="number"
                    min="0"
                    value={employeeForm.salaryStructure.basic}
                    onChange={(e) => handleSalaryFieldChange('basic', e.target.value)}
                  />
                </div>
                <div className="structure-group">
                  <label>HRA</label>
                  <input
                    type="number"
                    min="0"
                    value={employeeForm.salaryStructure.hra}
                    onChange={(e) => handleSalaryFieldChange('hra', e.target.value)}
                  />
                </div>
                <div className="structure-group">
                  <label>Special Allowance</label>
                  <input
                    type="number"
                    min="0"
                    value={employeeForm.salaryStructure.specialAllowance}
                    onChange={(e) => handleSalaryFieldChange('specialAllowance', e.target.value)}
                  />
                </div>
                <div className="structure-group">
                  <label>Professional Tax</label>
                  <input
                    type="number"
                    min="0"
                    value={employeeForm.salaryStructure.professionalTax}
                    onChange={(e) => handleSalaryFieldChange('professionalTax', e.target.value)}
                  />
                </div>
                <div className="structure-group">
                  <label>TDS</label>
                  <input
                    type="number"
                    min="0"
                    value={employeeForm.salaryStructure.tds}
                    onChange={(e) => handleSalaryFieldChange('tds', e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="modal-cancel-btn" onClick={closeAddModal}>
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
        <div className="modal-overlay" onClick={closeEmployeeDetail}>
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
              <div className="detail-section-header">
                <h3 className="detail-section-title">This month's attendance</h3>
                <button
                  type="button"
                  className="add-field-btn"
                  onClick={() => navigate(`/team-attendance?employeeId=${selectedEmployee._id}`)}
                >
                  View full month →
                </button>
              </div>
              {loadingDetail ? (
                <p className="loading-text">Loading...</p>
              ) : (
                <div className="detail-grid">
                  <div className="detail-field">
                    <p className="detail-label">Hours logged</p>
                    <p className="detail-value">{employeeHoursLogged.toFixed(2)} hrs</p>
                  </div>
                  <div className="detail-field">
                    <p className="detail-label">Days present</p>
                    <p className="detail-value">{employeeDaysPresent}</p>
                  </div>
                  <div className="detail-field">
                    <p className="detail-label">Flex hours</p>
                    <p className="detail-value">{employeeFlexHours.toFixed(2)} hrs</p>
                  </div>
                </div>
              )}
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">Leave requests</h3>
              {loadingDetail ? (
                <p className="loading-text">Loading...</p>
              ) : recentLeaves.length > 0 ? (
                <div className="detail-list">
                  {recentLeaves.map((leave) => (
                    <div key={leave._id} className="detail-list-row">
                      <div>
                        <p className="detail-list-title">{leave.leaveType} Leave</p>
                        <p className="detail-list-meta">
                          {formatDate(leave.startDate)} – {formatDate(leave.endDate)} · {leave.numberOfDays} day{leave.numberOfDays !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <span className={`status-badge ${leave.status}`}>{leave.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="detail-list-empty">No leave requests yet</p>
              )}
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">Correction requests</h3>
              {loadingDetail ? (
                <p className="loading-text">Loading...</p>
              ) : recentCorrections.length > 0 ? (
                <div className="detail-list">
                  {recentCorrections.map((correction) => (
                    <div key={correction._id} className="detail-list-row">
                      <div>
                        <p className="detail-list-title">{formatDate(correction.date)}</p>
                        <p className="detail-list-meta">
                          {correction.reason}
                          {(correction.requestedCheckInTime || correction.requestedCheckOutTime) && (
                            <>
                              {' · '}
                              {correction.requestedCheckInTime ? new Date(correction.requestedCheckInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                              {' – '}
                              {correction.requestedCheckOutTime ? new Date(correction.requestedCheckOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}
                            </>
                          )}
                        </p>
                      </div>
                      <span className={`status-badge ${correction.status}`}>{correction.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="detail-list-empty">No correction requests yet</p>
              )}
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">Reimbursement claims</h3>
              {loadingDetail ? (
                <p className="loading-text">Loading...</p>
              ) : recentExpenses.length > 0 ? (
                <div className="detail-list">
                  {recentExpenses.map((expense) => (
                    <div key={expense._id} className="detail-list-row">
                      <div>
                        <p className="detail-list-title">{expense.expenseType} · {formatCurrency(expense.amount)}</p>
                        <p className="detail-list-meta">{formatDate(expense.date)}{expense.description ? ` · ${expense.description}` : ''}</p>
                      </div>
                      <span className={`status-badge ${expense.status}`}>{expense.status}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="detail-list-empty">No reimbursement claims yet</p>
              )}
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">Documents uploaded</h3>
              {loadingDetail ? (
                <p className="loading-text">Loading...</p>
              ) : recentDocuments.length > 0 ? (
                <div className="detail-list">
                  {recentDocuments.map((doc) => (
                    <div key={doc._id} className="detail-list-row">
                      <div>
                        <p className="detail-list-title">{doc.fileName}</p>
                        <p className="detail-list-meta">{doc.documentType} · {formatDate(doc.uploadedDate)}</p>
                      </div>
                      <div className="detail-list-actions">
                        {doc.category !== 'company' && (
                          <span className={`verify-badge ${doc.verificationStatus}`}>{doc.verificationStatus}</span>
                        )}
                        <a
                          className="detail-download-link"
                          href={`${FILE_BASE_URL}${doc.fileUrl}`}
                          download={doc.fileName}
                          target="_blank"
                          rel="noreferrer"
                        >
                          ⬇
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="detail-list-empty">No documents uploaded yet</p>
              )}
            </div>

            <div className="detail-section">
              <div className="detail-section-header">
                <h3 className="detail-section-title">Salary</h3>
                {addingField ? (
                  <form className="add-field-form" onSubmit={handleConfirmAddField}>
                    <input
                      type="text"
                      autoFocus
                      className="add-field-input"
                      placeholder="Field name"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Escape') handleCancelAddField(); }}
                    />
                    <button type="submit" className="add-field-confirm-btn" aria-label="Add field">✓</button>
                    <button type="button" className="add-field-cancel-btn" onClick={handleCancelAddField} aria-label="Cancel">✕</button>
                  </form>
                ) : (
                  <button type="button" className="add-field-btn" onClick={() => setAddingField(true)}>
                    + Add Field
                  </button>
                )}
              </div>
              {loadingDetail ? (
                <p className="loading-text">Loading...</p>
              ) : employeeLatestPayslip ? (
                <div className="detail-grid">
                  <div className="detail-field">
                    <p className="detail-label">Net pay · {MONTH_NAMES[employeeLatestPayslip.month - 1]} {employeeLatestPayslip.year}</p>
                    <p className="detail-value">{formatCurrency(employeeLatestPayslip.netSalary)}</p>
                  </div>
                  <div className="detail-field">
                    <p className="detail-label">Gross</p>
                    <p className="detail-value">{formatCurrency(employeeLatestPayslip.grossSalary)}</p>
                  </div>
                  <div className="detail-field">
                    <p className="detail-label">Deductions</p>
                    <p className="detail-value">{formatCurrency(employeeLatestPayslip.totalDeductions)}</p>
                  </div>
                  <div className="detail-field">
                    <p className="detail-label">Status</p>
                    <p className="detail-value">
                      <span className={`status-badge ${employeeLatestPayslip.paymentStatus === 'paid' ? 'paid' : 'processing'}`}>
                        {employeeLatestPayslip.paymentStatus === 'paid' ? 'Paid' : 'Processing'}
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                <p className="detail-list-empty">No payslips generated yet</p>
              )}
              {!loadingDetail && customSalaryFields.length > 0 && (
                <div className="detail-grid custom-fields-grid">
                  {customSalaryFields.map((field) => (
                    <div className="detail-field" key={field.id}>
                      <p className="detail-label">{field.name}</p>
                      <input
                        type="text"
                        className="custom-field-input"
                        value={field.value}
                        onChange={(e) => handleCustomFieldValueChange(field.id, e.target.value)}
                        placeholder="Enter value"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-actions">
              <button type="button" className="modal-cancel-btn" onClick={closeEmployeeDetail}>
                Close
              </button>
              <button
                type="button"
                className="modal-submit-btn"
                onClick={() => navigate(`/team-attendance?employeeId=${selectedEmployee._id}`)}
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

export default Employees;
