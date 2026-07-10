import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  userAPI,
  attendanceAPI,
  leaveAPI,
  flexHoursAPI,
  expenseAPI,
  documentAPI,
  assetAPI,
  payslipAPI,
  FILE_BASE_URL
} from '../services/api';
import { buildMonthAttendanceRows, summarizeMonthRows, getDayStatus } from '../utils/attendanceCalendar';
import { downloadPayslipPdf } from '../utils/payslipPdf';
import './ManagerDashboard.css';
import './Attendance.css';
import './Salary.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [2023, 2024, 2025, 2026];

const formatCurrency = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

const formatDate = (date) =>
  new Date(date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' });

const getStatusLabel = (paymentStatus) =>
  paymentStatus === 'paid'
    ? { label: 'Paid', className: 'paid' }
    : { label: 'Processing', className: 'processing' };

const EmployeeProfile = () => {
  const { employeeId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [employee, setEmployee] = useState(null);
  const [loadingEmployee, setLoadingEmployee] = useState(true);

  const [corrections, setCorrections] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [assets, setAssets] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [latestPayslip, setLatestPayslip] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(true);

  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [attendance, setAttendance] = useState([]);
  const [flexRequests, setFlexRequests] = useState([]);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [expandedRows, setExpandedRows] = useState(new Set());

  useEffect(() => {
    const fetchEmployee = async () => {
      try {
        setLoadingEmployee(true);
        const res = await userAPI.getUserById(employeeId);
        setEmployee(res.data.user || null);
      } catch (error) {
        console.error('Error loading employee:', error);
        setEmployee(null);
      } finally {
        setLoadingEmployee(false);
      }
    };

    const fetchStaticDetail = async () => {
      try {
        setLoadingDetail(true);
        const [correctionsRes, expensesRes, documentsRes, assetsRes, payslipsRes, leavesRes] = await Promise.all([
          attendanceAPI.getCorrectionRequests({ employeeId }),
          expenseAPI.getExpenses({ employeeId }),
          documentAPI.getDocuments({ employeeId }),
          assetAPI.getAssets({ employeeId }),
          payslipAPI.getPayslips({ employeeId }),
          leaveAPI.getEmployeeLeaves(employeeId)
        ]);
        setCorrections(correctionsRes.data.corrections || []);
        setExpenses(expensesRes.data.expenses || []);
        setDocuments(documentsRes.data.documents || []);
        setAssets(assetsRes.data.assets || []);
        setPayslips(payslipsRes.data.payslips || []);
        setLatestPayslip((payslipsRes.data.payslips || [])[0] || null);
        setLeaves(leavesRes.data.leaves || []);
      } catch (error) {
        console.error('Error loading employee detail:', error);
      } finally {
        setLoadingDetail(false);
      }
    };

    fetchEmployee();
    fetchStaticDetail();
  }, [employeeId]);

  const fetchAttendance = useCallback(async () => {
    try {
      setLoadingAttendance(true);
      const [attendanceRes, flexRes] = await Promise.all([
        attendanceAPI.getAttendance({ employeeId, month: selectedMonth, year: selectedYear }),
        flexHoursAPI.getFlexHoursRequests({ employeeId })
      ]);
      setAttendance(attendanceRes.data.attendance || []);
      setFlexRequests(flexRes.data.requests || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setLoadingAttendance(false);
    }
  }, [employeeId, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const toggleRowDetail = (key) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const rows = buildMonthAttendanceRows({
    dateOfJoining: employee?.dateOfJoining,
    attendance,
    leaves,
    month: selectedMonth,
    year: selectedYear
  });

  const appliedFlexByDate = flexRequests
    .filter((r) => r.status !== 'rejected')
    .reduce((acc, r) => {
      const key = new Date(r.date).toDateString();
      acc[key] = (acc[key] || 0) + r.hoursRequested;
      return acc;
    }, {});

  const { presentCount } = summarizeMonthRows(rows, appliedFlexByDate);
  const totalHours = attendance.reduce((sum, r) => sum + (r.hoursWorked || 0), 0);

  const getReimbursementsFor = (month, year) =>
    expenses
      .filter((e) => {
        if (e.status !== 'approved' && e.status !== 'reimbursed') return false;
        const d = new Date(e.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      })
      .reduce((sum, e) => sum + e.amount, 0);

  const handleDownloadPayslip = (payslip) => {
    if (!employee) return;
    downloadPayslipPdf({
      payslip,
      employeeName: `${employee.firstName} ${employee.lastName}`,
      designation: employee.designation,
      employeeIdStr: employee._id.slice(-6).toUpperCase(),
      reimbursement: getReimbursementsFor(payslip.month, payslip.year)
    });
  };

  const recentLeaves = [...leaves].sort((a, b) => new Date(b.startDate) - new Date(a.startDate)).slice(0, 5);
  const recentCorrections = [...corrections].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const recentExpenses = [...expenses].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 5);
  const recentDocuments = documents.slice(0, 5);

  if (!loadingEmployee && !employee) {
    return (
      <div className="manager-dashboard-page">
        <button type="button" className="profile-back-btn" onClick={() => navigate('/employees')}>
          ← Back to Employees
        </button>
        <p className="no-records">Employee not found</p>
      </div>
    );
  }

  return (
    <div className="manager-dashboard-page">
      <div className="profile-header-row">
        <button type="button" className="profile-back-btn" onClick={() => navigate('/employees')}>
          ← Back to Employees
        </button>
      </div>

      <div className="profile-section-card">
        {loadingEmployee ? (
          <p className="loading-text">Loading...</p>
        ) : (
          <>
            <div className="detail-header">
              <div className="detail-avatar">
                {employee.firstName?.charAt(0)}{employee.lastName?.charAt(0)}
              </div>
              <div>
                <h2 className="detail-name">
                  {employee.firstName} {employee.lastName}
                  {employee._id === user._id ? ' (You)' : ''}
                </h2>
                <p className="detail-role">{employee.designation} · {employee.department}</p>
              </div>
              <span className={`role-badge ${employee.role}`}>{employee.role}</span>
              {employee.status && employee.status !== 'active' && (
                <span className="status-badge resigned">{employee.status === 'resigned' ? 'Resigned' : 'Inactive'}</span>
              )}
            </div>

            <div className="detail-section">
              <div className="detail-grid">
                <div className="detail-field">
                  <p className="detail-label">Email</p>
                  <p className="detail-value">{employee.email}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Phone</p>
                  <p className="detail-value">{employee.phone || '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Date of Joining</p>
                  <p className="detail-value">
                    {employee.dateOfJoining ? formatDate(employee.dateOfJoining) : '—'}
                  </p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Work Mode</p>
                  <p className="detail-value">{employee.workMode || '—'}</p>
                </div>
              </div>
            </div>

            <div className="detail-section">
              <h3 className="detail-section-title">Leave balance</h3>
              <div className="detail-grid">
                <div className="detail-field">
                  <p className="detail-label">Casual</p>
                  <p className="detail-value">{employee.casualLeaveBalance ?? '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Sick</p>
                  <p className="detail-value">{employee.sickLeaveBalance ?? '—'}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Earned</p>
                  <p className="detail-value">{employee.earnedLeaveBalance ?? '—'}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="profile-section-card">
        <div className="detail-section-header">
          <h3 className="detail-section-title">Attendance</h3>
          <div className="month-selector">
            <select value={selectedMonth} onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}>
              {MONTH_NAMES.map((m, idx) => (
                <option key={m} value={idx + 1}>{m}</option>
              ))}
            </select>
            <select value={selectedYear} onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}>
              {YEARS.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
        </div>

        {!loadingAttendance && attendance.length > 0 && (
          <div className="history-summary">
            <span><strong>{totalHours.toFixed(2)}</strong> hrs total</span>
            <span><strong>{presentCount}</strong> days present</span>
          </div>
        )}

        {loadingAttendance ? (
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
                        <td><p className="date-label">{formatDate(row.date)}</p></td>
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
                        <td><p className="date-label">{formatDate(row.date)}</p></td>
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
                        <td><p className="date-label">{formatDate(row.date)}</p></td>
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
                  const appliedFlex = appliedFlexByDate[row.date.toDateString()] || 0;
                  const status = getDayStatus(record, row.date, appliedFlex);
                  const flexParts = [];
                  if (flexHours > 0) flexParts.push(`+${flexHours.toFixed(2)} earned`);
                  if (appliedFlex > 0) flexParts.push(`+${appliedFlex.toFixed(2)} applied`);

                  return (
                    <React.Fragment key={record._id}>
                      <tr className="attendance-table-row">
                        <td>
                          <p className="date-label">{formatDate(row.date)}</p>
                          <p className="work-mode">{record.workMode}</p>
                        </td>
                        <td>
                          <div className="status-cell">
                            <span className={`status-badge ${status.className}`}>{status.label}</span>
                            {status.detail && (
                              <button
                                type="button"
                                className="status-info-btn"
                                onClick={() => toggleRowDetail(record._id)}
                                aria-label="View calculation"
                              >
                                i
                              </button>
                            )}
                          </div>
                        </td>
                        <td>{record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                        <td>{record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }) : '-'}</td>
                        <td>{workingHours.toFixed(2)} hrs</td>
                        <td>{flexParts.length > 0 ? flexParts.join(', ') : '-'}</td>
                      </tr>
                      {expandedRows.has(record._id) && (
                        <tr className="detail-breakdown-row">
                          <td colSpan={6}>
                            <div className="detail-breakdown">
                              {status.detail && <p className="status-detail">{status.detail}</p>}
                              {record.sessions && record.sessions.length > 1 && (
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
          <p className="no-records">No attendance records for this month</p>
        )}
      </div>

      <div className="profile-section-card">
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

      <div className="profile-section-card">
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

      <div className="profile-section-card">
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

      <div className="profile-section-card">
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

      <div className="profile-section-card">
        <h3 className="detail-section-title">Assets</h3>
        {loadingDetail ? (
          <p className="loading-text">Loading...</p>
        ) : assets.length > 0 ? (
          <div className="detail-list">
            {assets.map((asset) => (
              <div key={asset._id} className="detail-list-row">
                <div>
                  <p className="detail-list-title">{asset.itemName}</p>
                  <p className="detail-list-meta">
                    {asset.serialNumber && `${asset.serialNumber} · `}
                    assigned {formatDate(asset.assignedDate)}
                    {asset.status === 'returned' && asset.returnedDate && ` · returned ${formatDate(asset.returnedDate)}`}
                  </p>
                </div>
                <span className={`status-badge ${asset.status}`}>
                  {asset.status === 'active' ? 'Active' : 'Returned'}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="detail-list-empty">No assets assigned yet</p>
        )}
      </div>

      <div className="profile-section-card">
        <div className="detail-section-header">
          <h3 className="detail-section-title">Salary</h3>
          <button type="button" className="add-field-btn" onClick={() => navigate(`/payroll?employeeId=${employeeId}`)}>
            View full calculation in Payroll →
          </button>
        </div>
        {loadingDetail ? (
          <p className="loading-text">Loading...</p>
        ) : latestPayslip ? (
          <>
            <div className="net-pay-card">
              <div>
                <p className="net-pay-label">Net pay · {MONTH_NAMES[latestPayslip.month - 1]} {latestPayslip.year}</p>
                <h2 className="net-pay-value">{formatCurrency(latestPayslip.netSalary)}</h2>
              </div>
              <div>
                <p className="net-pay-label">Status</p>
                <span className={`status-badge ${latestPayslip.paymentStatus === 'paid' ? 'paid' : 'processing'}`}>
                  {latestPayslip.paymentStatus === 'paid' ? 'Paid' : 'Processing'}
                </span>
              </div>
            </div>
            <div className="breakdown-grid">
              <div className="breakdown-card">
                <h3 className="breakdown-title">Earnings</h3>
                <div className="breakdown-row">
                  <span>Basic</span>
                  <span>{formatCurrency(latestPayslip.earnings?.basic)}</span>
                </div>
                <div className="breakdown-row">
                  <span>HRA</span>
                  <span>{formatCurrency(latestPayslip.earnings?.hra)}</span>
                </div>
                <div className="breakdown-row">
                  <span>Special Allowance</span>
                  <span>{formatCurrency(latestPayslip.earnings?.specialAllowance)}</span>
                </div>
                <div className="breakdown-row total-row">
                  <span>Gross Earnings</span>
                  <span>{formatCurrency(latestPayslip.grossSalary)}</span>
                </div>
              </div>
              <div className="breakdown-card">
                <h3 className="breakdown-title">Deductions</h3>
                <div className="breakdown-row">
                  <span>PF (12% of basic)</span>
                  <span className="negative">-{formatCurrency(latestPayslip.deductions?.pf)}</span>
                </div>
                <div className="breakdown-row">
                  <span>Professional Tax</span>
                  <span className="negative">-{formatCurrency(latestPayslip.deductions?.professionalTax)}</span>
                </div>
                <div className="breakdown-row">
                  <span>TDS</span>
                  <span className="negative">-{formatCurrency(latestPayslip.deductions?.tds)}</span>
                </div>
                <div className="breakdown-row">
                  <span>LOP ({latestPayslip.deductions?.lopDays || 0} days)</span>
                  <span className="negative">-{formatCurrency(latestPayslip.deductions?.lopAmount)}</span>
                </div>
                <div className="breakdown-row total-row">
                  <span>Total deductions</span>
                  <span className="negative">-{formatCurrency(latestPayslip.totalDeductions)}</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <>
            <p className="detail-list-empty">No payslips generated yet</p>
            {employee?.salaryStructure && (
              <div className="detail-grid">
                <div className="detail-field">
                  <p className="detail-label">Basic</p>
                  <p className="detail-value">{formatCurrency(employee.salaryStructure.basic)}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">HRA</p>
                  <p className="detail-value">{formatCurrency(employee.salaryStructure.hra)}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Special Allowance</p>
                  <p className="detail-value">{formatCurrency(employee.salaryStructure.specialAllowance)}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">Professional Tax</p>
                  <p className="detail-value">{formatCurrency(employee.salaryStructure.professionalTax)}</p>
                </div>
                <div className="detail-field">
                  <p className="detail-label">TDS</p>
                  <p className="detail-value">{formatCurrency(employee.salaryStructure.tds)}</p>
                </div>
              </div>
            )}
          </>
        )}
        {!loadingDetail && employee?.customSalaryFields && Object.keys(employee.customSalaryFields).length > 0 && (
          <div className="detail-grid custom-fields-grid">
            {Object.entries(employee.customSalaryFields).map(([name, value]) => (
              <div className="detail-field" key={name}>
                <p className="detail-label">{name}</p>
                <p className="detail-value">{value || '-'}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {!loadingDetail && payslips.length > 0 && (
        <div className="profile-section-card history-card">
          <h3 className="breakdown-title">Salary history</h3>
          <div className="table-wrapper">
            <table className="salary-table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Gross Salary</th>
                  <th>Deductions</th>
                  <th>Reimbursements</th>
                  <th>Net Pay</th>
                  <th>Status</th>
                  <th>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {payslips.map((p) => {
                  const reimbursement = getReimbursementsFor(p.month, p.year);
                  const status = getStatusLabel(p.paymentStatus);

                  return (
                    <tr key={p._id}>
                      <td>{MONTH_NAMES[p.month - 1]} {p.year}</td>
                      <td>{formatCurrency(p.grossSalary)}</td>
                      <td className="negative">-{formatCurrency(p.totalDeductions)}</td>
                      <td>{reimbursement > 0 ? formatCurrency(reimbursement) : '-'}</td>
                      <td className="net-cell">{formatCurrency(p.netSalary + reimbursement)}</td>
                      <td>
                        {status && <span className={`status-badge ${status.className}`}>{status.label}</span>}
                      </td>
                      <td>
                        <button className="history-download-btn" onClick={() => handleDownloadPayslip(p)}>
                          ⬇ Download
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeProfile;
