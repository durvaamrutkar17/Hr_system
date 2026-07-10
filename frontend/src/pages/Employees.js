import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, attendanceAPI } from '../services/api';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import PasswordInput from '../components/PasswordInput';
import { validateEmployeeForm } from '../utils/formValidation';
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
  const [customFields, setCustomFields] = useState([]);
  const [addingField, setAddingField] = useState(false);
  const [newFieldName, setNewFieldName] = useState('');
  const [newFieldType, setNewFieldType] = useState('earning');
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
    setCustomFields([]);
    setAddingField(false);
    setNewFieldName('');
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

  const handleConfirmAddField = () => {
    if (!newFieldName.trim()) return;
    setCustomFields((prev) => [...prev, { id: Date.now(), name: newFieldName.trim(), value: '', type: newFieldType }]);
    setNewFieldName('');
    setNewFieldType('earning');
    setAddingField(false);
  };

  const handleCancelAddField = () => {
    setAddingField(false);
    setNewFieldName('');
    setNewFieldType('earning');
  };

  const handleCustomFieldValueChange = (id, value) => {
    setCustomFields((prev) => prev.map((field) => (field.id === id ? { ...field, value } : field)));
  };

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
        },
        customSalaryFields: customFields.map(({ name, value, type }) => ({ name, value, type }))
      });
      showToast('success', 'Employee added');
      setShowAddModal(false);
      setEmployeeForm(emptyEmployeeForm);
      setEmployeeFormErrors({});
      setCustomFields([]);
      setAddingField(false);
      setNewFieldName('');
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
                <div key={emp._id} className="team-row" onClick={() => navigate(`/employees/${emp._id}`)}>
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

              <div className="detail-section-header">
                <p className="modal-section-label" style={{ margin: 0 }}>Salary structure</p>
                {addingField ? (
                  <div className="add-field-form">
                    <input
                      type="text"
                      autoFocus
                      className="add-field-input"
                      placeholder="Field name"
                      value={newFieldName}
                      onChange={(e) => setNewFieldName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleConfirmAddField(); }
                        if (e.key === 'Escape') handleCancelAddField();
                      }}
                    />
                    <select
                      className="add-field-type"
                      value={newFieldType}
                      onChange={(e) => setNewFieldType(e.target.value)}
                    >
                      <option value="earning">Earning</option>
                      <option value="deduction">Deduction</option>
                    </select>
                    <button type="button" className="add-field-confirm-btn" onClick={handleConfirmAddField} aria-label="Add field">✓</button>
                    <button type="button" className="add-field-cancel-btn" onClick={handleCancelAddField} aria-label="Cancel">✕</button>
                  </div>
                ) : (
                  <button type="button" className="add-field-btn" onClick={() => setAddingField(true)}>
                    + Add Field
                  </button>
                )}
              </div>
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

              {customFields.some((f) => f.type !== 'deduction') && (
                <>
                  <p className="modal-section-label custom-fields-subhead">Additional earnings</p>
                  <div className="structure-form">
                    {customFields.filter((f) => f.type !== 'deduction').map((field) => (
                      <div className="structure-group" key={field.id}>
                        <label>{field.name}</label>
                        <input
                          type="number"
                          min="0"
                          value={field.value}
                          onChange={(e) => handleCustomFieldValueChange(field.id, e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

              {customFields.some((f) => f.type === 'deduction') && (
                <>
                  <p className="modal-section-label custom-fields-subhead">Additional deductions</p>
                  <div className="structure-form">
                    {customFields.filter((f) => f.type === 'deduction').map((field) => (
                      <div className="structure-group" key={field.id}>
                        <label>{field.name}</label>
                        <input
                          type="number"
                          min="0"
                          value={field.value}
                          onChange={(e) => handleCustomFieldValueChange(field.id, e.target.value)}
                          placeholder="0"
                        />
                      </div>
                    ))}
                  </div>
                </>
              )}

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
    </div>
  );
};

export default Employees;
