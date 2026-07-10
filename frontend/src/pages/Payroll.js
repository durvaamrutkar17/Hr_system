import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userAPI, attendanceAPI, leaveAPI, flexHoursAPI, expenseAPI, payslipAPI, FILE_BASE_URL } from '../services/api';
import { buildMonthAttendanceRows, computeLopBreakdown } from '../utils/attendanceCalendar';
import { computeSalaryFigures, splitCustomSalaryFields } from '../utils/salaryCalc';
import { downloadPayslipPdf } from '../utils/payslipPdf';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import './Salary.css';
import './Payroll.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];
const YEARS = [2023, 2024, 2025, 2026];

const formatCurrency = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

const toNumber = (value) => Number(value) || 0;

const sanitizeIntInput = (value) => {
  if (value === '') return '';
  const num = parseInt(value, 10);
  return Number.isNaN(num) ? '' : String(Math.max(0, num));
};

// LOP is tracked in half-day increments (a Half Day costs 0.5, an Absent costs 1).
const sanitizeLopInput = (value) => {
  if (value === '') return '';
  const num = parseFloat(value);
  if (Number.isNaN(num)) return '';
  return String(Math.round(Math.max(0, num) * 2) / 2);
};

const LOP_TYPE_LABELS = {
  absent: 'Absent',
  'half-day': 'Half Day',
  'unpaid-leave': 'Unpaid leave'
};

const idOf = (refOrId) => refOrId?._id || refOrId;

const CLAIM_STATUS_LABELS = {
  submitted: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  reimbursed: 'Reimbursed'
};

const CLAIM_TABS = [
  { key: 'pending', label: 'Pending', match: (e) => e.status === 'submitted' },
  { key: 'approved', label: 'Approved', match: (e) => e.status === 'approved' || e.status === 'reimbursed' },
  { key: 'rejected', label: 'Rejected', match: (e) => e.status === 'rejected' },
  { key: 'all', label: 'All', match: () => true }
];

const computeRow = (row) => computeSalaryFigures({
  basic: toNumber(row.basic),
  hra: toNumber(row.hra),
  specialAllowance: toNumber(row.specialAllowance),
  professionalTax: toNumber(row.professionalTax),
  tds: toNumber(row.tds),
  lopDays: toNumber(row.lopDays),
  reimbursement: toNumber(row.reimbursement),
  customEarnings: toNumber(row.customEarningsTotal),
  customDeductions: toNumber(row.customDeductionsTotal)
});

// LOP days + a per-date breakdown, computed the same way the employee's own attendance
// page and the manager's Team Attendance page classify each day — so LOP always agrees
// with what an employee sees there (Half Day costs 0.5 day, Absent costs a full day),
// flex hours included.
const computeLopInfo = (emp, attendance, leaves, flexRequests, month, year) => {
  const empId = emp._id;
  const empAttendance = attendance.filter((r) => idOf(r.employeeId) === empId);
  const empLeaves = leaves.filter((l) => idOf(l.employeeId) === empId);

  const appliedFlexByDate = flexRequests
    .filter((r) => idOf(r.employeeId) === empId && r.status !== 'rejected')
    .reduce((acc, r) => {
      const key = new Date(r.date).toDateString();
      acc[key] = (acc[key] || 0) + r.hoursRequested;
      return acc;
    }, {});

  const rows = buildMonthAttendanceRows({
    dateOfJoining: emp.dateOfJoining,
    attendance: empAttendance,
    leaves: empLeaves,
    month,
    year
  });

  return computeLopBreakdown(rows, appliedFlexByDate);
};

const getReimbursementClaimsFor = (expenses, empId, month, year) =>
  expenses
    .filter((e) => idOf(e.employeeId) === empId)
    .filter((e) => e.status === 'approved' || e.status === 'reimbursed')
    .filter((e) => {
      const d = new Date(e.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

const getStatusInfo = (payslip) => {
  if (!payslip) return { label: 'Not processed', className: 'not-processed' };
  if (payslip.paymentStatus === 'paid') return { label: 'Paid', className: 'paid' };
  return { label: 'Processing', className: 'processing' };
};

const Payroll = () => {
  const { user } = useAuth();
  const location = useLocation();
  const highlightedEmployeeId = new URLSearchParams(location.search).get('employeeId');
  const highlightedRowRef = useRef(null);
  const [employees, setEmployees] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payslips, setPayslips] = useState([]);
  const [rows, setRows] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [processingAll, setProcessingAll] = useState(false);
  const [rowActionId, setRowActionId] = useState(null);
  const [claimActionId, setClaimActionId] = useState(null);
  const [claimsTab, setClaimsTab] = useState('pending');
  const [confirmState, setConfirmState] = useState(null);
  const { message, showToast } = useToast();

  const buildRows = useCallback((employeeList, attendanceList, leaveList, flexList, expenseList, payslipList) => {
    const nextRows = {};
    employeeList.forEach((emp) => {
      const payslip = payslipList.find((p) => idOf(p.employeeId) === emp._id) || null;
      const reimbursementClaims = getReimbursementClaimsFor(expenseList, emp._id, selectedMonth, selectedYear);
      const reimbursement = reimbursementClaims.reduce((sum, e) => sum + e.amount, 0);
      const lopInfo = computeLopInfo(emp, attendanceList, leaveList, flexList, selectedMonth, selectedYear);
      const {
        earnings: customEarnings,
        deductions: customDeductions,
        earningsTotal: customEarningsTotal,
        deductionsTotal: customDeductionsTotal
      } = splitCustomSalaryFields(emp.customSalaryFields);

      if (payslip) {
        nextRows[emp._id] = {
          basic: payslip.earnings.basic,
          hra: payslip.earnings.hra,
          specialAllowance: payslip.earnings.specialAllowance,
          professionalTax: payslip.deductions.professionalTax,
          tds: payslip.deductions.tds,
          lopDays: payslip.deductions.lopDays,
          lopBreakdown: lopInfo.breakdown,
          reimbursement,
          reimbursementClaims,
          customEarnings,
          customDeductions,
          customEarningsTotal,
          customDeductionsTotal,
          expanded: false,
          lopExpanded: false,
          reimbursementExpanded: false
        };
      } else {
        nextRows[emp._id] = {
          basic: emp.salaryStructure?.basic || 0,
          hra: emp.salaryStructure?.hra || 0,
          specialAllowance: emp.salaryStructure?.specialAllowance || 0,
          professionalTax: emp.salaryStructure?.professionalTax || 0,
          tds: emp.salaryStructure?.tds || 0,
          lopDays: lopInfo.lopDays,
          lopBreakdown: lopInfo.breakdown,
          reimbursement,
          reimbursementClaims,
          customEarnings,
          customDeductions,
          customEarningsTotal,
          customDeductionsTotal,
          expanded: false,
          lopExpanded: false,
          reimbursementExpanded: false
        };
      }
    });
    return nextRows;
  }, [selectedMonth, selectedYear]);

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, attendanceRes, leavesRes, flexRes, expensesRes, payslipsRes] = await Promise.all([
        userAPI.getUsers(),
        attendanceAPI.getAttendance({ month: selectedMonth, year: selectedYear }),
        leaveAPI.getLeaves(),
        flexHoursAPI.getFlexHoursRequests({}),
        expenseAPI.getExpenses({}),
        payslipAPI.getPayslips({ month: selectedMonth, year: selectedYear })
      ]);

      const employeeList = usersRes.data.users || [];
      const attendanceList = attendanceRes.data.attendance || [];
      const leaveList = leavesRes.data.leaves || [];
      const flexList = flexRes.data.requests || [];
      const expenseList = expensesRes.data.expenses || [];
      const payslipList = payslipsRes.data.payslips || [];

      setEmployees(employeeList);
      setExpenses(expenseList);
      setPayslips(payslipList);
      setRows(buildRows(employeeList, attendanceList, leaveList, flexList, expenseList, payslipList));
    } catch (error) {
      console.error('Error loading payroll:', error);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, buildRows]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const hasAutoExpandedRef = useRef(false);
  useEffect(() => {
    if (!highlightedEmployeeId || hasAutoExpandedRef.current || !rows[highlightedEmployeeId]) return;
    hasAutoExpandedRef.current = true;
    setRows((prev) => ({
      ...prev,
      [highlightedEmployeeId]: { ...prev[highlightedEmployeeId], expanded: true }
    }));
  }, [rows, highlightedEmployeeId]);

  useEffect(() => {
    if (highlightedEmployeeId && rows[highlightedEmployeeId]?.expanded && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows[highlightedEmployeeId]?.expanded]);

  const updateRow = (empId, field, value) => {
    setRows((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], [field]: value }
    }));
  };

  const toggleExpanded = (empId) => {
    setRows((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], expanded: !prev[empId].expanded }
    }));
  };

  const toggleLopBreakdown = (empId) => {
    setRows((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], lopExpanded: !prev[empId].lopExpanded }
    }));
  };

  const toggleReimbursementBreakdown = (empId) => {
    setRows((prev) => ({
      ...prev,
      [empId]: { ...prev[empId], reimbursementExpanded: !prev[empId].reimbursementExpanded }
    }));
  };

  const payslipFor = (empId) => payslips.find((p) => idOf(p.employeeId) === empId) || null;

  const processEmployee = async (emp) => {
    const row = rows[emp._id];
    if (!toNumber(row.basic)) {
      showToast('error', `Set a Basic salary for ${emp.firstName} ${emp.lastName} before processing.`);
      return;
    }

    try {
      setRowActionId(emp._id);
      await payslipAPI.createPayslip({
        employeeId: emp._id,
        month: selectedMonth,
        year: selectedYear,
        earnings: {
          basic: toNumber(row.basic),
          hra: toNumber(row.hra),
          specialAllowance: toNumber(row.specialAllowance),
          custom: row.customEarnings
        },
        deductions: {
          professionalTax: toNumber(row.professionalTax),
          tds: toNumber(row.tds),
          lopDays: toNumber(row.lopDays),
          custom: row.customDeductions
        }
      });
      showToast('success', `Payslip processed for ${emp.firstName} ${emp.lastName}`);
      fetchAll();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setRowActionId(null);
    }
  };

  const handleProcessAll = () => {
    const missingBasic = employees.filter((emp) => !toNumber(rows[emp._id]?.basic));
    if (missingBasic.length > 0) {
      showToast(
        'error',
        'Set a Basic salary for: ' +
        missingBasic.map((e) => `${e.firstName} ${e.lastName}`).join(', ') +
        ' before processing payroll.'
      );
      return;
    }

    setConfirmState({
      message: `Process payroll for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear} for all employees?`,
      confirmLabel: 'Process all',
      onConfirm: performProcessAll
    });
  };

  const performProcessAll = async () => {
    setConfirmState(null);
    try {
      setProcessingAll(true);
      await Promise.all(employees.map((emp) => {
        const row = rows[emp._id];
        return payslipAPI.createPayslip({
          employeeId: emp._id,
          month: selectedMonth,
          year: selectedYear,
          earnings: {
            basic: toNumber(row.basic),
            hra: toNumber(row.hra),
            specialAllowance: toNumber(row.specialAllowance),
            custom: row.customEarnings
          },
          deductions: {
            professionalTax: toNumber(row.professionalTax),
            tds: toNumber(row.tds),
            lopDays: toNumber(row.lopDays),
            custom: row.customDeductions
          }
        });
      }));
      showToast('success', 'Payroll processed for ' + MONTH_NAMES[selectedMonth - 1]);
      fetchAll();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setProcessingAll(false);
    }
  };

  const handleMarkPaid = async (payslip) => {
    try {
      setRowActionId(idOf(payslip.employeeId));
      await payslipAPI.updatePayslip(payslip._id, { paymentStatus: 'paid', paymentDate: new Date().toISOString() });
      showToast('success', 'Marked as paid');
      fetchAll();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setRowActionId(null);
    }
  };

  const handleDownload = (emp, payslip) => {
    downloadPayslipPdf({
      payslip,
      employeeName: `${emp.firstName} ${emp.lastName}`,
      designation: emp.designation,
      employeeIdStr: emp._id.slice(-6).toUpperCase(),
      reimbursement: rows[emp._id]?.reimbursement || 0
    });
  };

  const handleClaimDecision = async (id, status) => {
    try {
      setClaimActionId(id);
      await expenseAPI.updateExpense(id, { status });
      showToast('success', `Claim ${status}`);
      fetchAll();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setClaimActionId(null);
    }
  };

  const allProcessed = employees.length > 0 && employees.every((emp) => payslipFor(emp._id));

  return (
    <div className="payroll-page">
      <p className="eyebrow">Salary Run</p>
      <div className="payroll-page-header">
        <h1 className="page-title">Payroll</h1>
        <div className="month-filter">
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

      <Toast message={message} />

      <div className="calculator-card">
        <div className="calculator-card-header">
          <h2 className="section-title">Salary — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h2>
          {!loading && employees.length > 0 && (
            allProcessed ? (
              <span className="status-badge processed-all">Processed</span>
            ) : (
              <button className="process-btn" onClick={handleProcessAll} disabled={processingAll}>
                {processingAll ? 'Processing...' : `Process salary for ${MONTH_NAMES[selectedMonth - 1]}`}
              </button>
            )
          )}
        </div>

        {loading ? (
          <p className="loading-text">Loading employees...</p>
        ) : employees.length > 0 ? (
          <div className="table-wrapper">
            <table className="payroll-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Gross Salary</th>
                  <th>Deduction</th>
                  <th>Reimbursement</th>
                  <th>LOP days</th>
                  <th>Net Pay</th>
                  <th>Status</th>
                  <th>Payslip</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const row = rows[emp._id];
                  if (!row) return null;
                  const computed = computeRow(row);
                  const payslip = payslipFor(emp._id);
                  const status = getStatusInfo(payslip);
                  const isRowBusy = rowActionId === emp._id;

                  const isHighlighted = emp._id === highlightedEmployeeId;

                  return (
                    <React.Fragment key={emp._id}>
                      <tr ref={isHighlighted ? highlightedRowRef : undefined} className={isHighlighted ? 'highlighted-row' : ''}>
                        <td>
                          <button type="button" className="emp-name-link" onClick={() => toggleExpanded(emp._id)}>
                            {emp._id === user._id ? `You (${emp.firstName} ${emp.lastName})` : `${emp.firstName} ${emp.lastName}`}
                          </button>
                          <p className="emp-role">{emp.designation}</p>
                          <button type="button" className="edit-toggle-btn" onClick={() => toggleExpanded(emp._id)}>
                            {row.expanded ? 'Hide salary structure' : 'View salary structure'}
                          </button>
                        </td>
                        <td>{formatCurrency(computed.gross)}</td>
                        <td className="negative">-{formatCurrency(computed.totalDeductions)}</td>
                        <td>{row.reimbursement > 0 ? formatCurrency(row.reimbursement) : '-'}</td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            max="31"
                            step="0.5"
                            className="lop-input"
                            value={row.lopDays}
                            onChange={(e) => updateRow(emp._id, 'lopDays', sanitizeLopInput(e.target.value))}
                          />
                          {row.lopBreakdown.length > 0 && (
                            <p className="lop-summary-note">
                              {['half-day', 'absent', 'unpaid-leave'].map((type) => {
                                const count = row.lopBreakdown.filter((b) => b.type === type).length;
                                return count > 0 ? `${count} ${LOP_TYPE_LABELS[type]}` : null;
                              }).filter(Boolean).join(', ')}
                            </p>
                          )}
                        </td>
                        <td className="net-cell">{formatCurrency(computed.netPay)}</td>
                        <td>
                          <div className="status-cell">
                            <span className={`status-badge ${status.className}`}>{status.label}</span>
                            {payslip && payslip.paymentStatus !== 'paid' && (
                              <button
                                type="button"
                                className="mark-paid-btn"
                                onClick={() => handleMarkPaid(payslip)}
                                disabled={isRowBusy}
                              >
                                Mark paid
                              </button>
                            )}
                          </div>
                        </td>
                        <td>
                          <div className="payslip-cell">
                            {payslip ? (
                              <>
                                <button type="button" className="history-download-btn" onClick={() => handleDownload(emp, payslip)}>
                                  ⬇ Download
                                </button>
                                <button
                                  type="button"
                                  className="reprocess-btn"
                                  onClick={() => processEmployee(emp)}
                                  disabled={isRowBusy}
                                >
                                  {isRowBusy ? '...' : 'Reprocess'}
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="process-row-btn"
                                onClick={() => processEmployee(emp)}
                                disabled={isRowBusy}
                              >
                                {isRowBusy ? 'Processing...' : 'Process'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {row.expanded && (
                        <tr className="structure-row">
                          <td colSpan={8}>
                            <div className="net-pay-card employee-salary-header">
                              <div>
                                <p className="net-pay-label">Net pay · {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</p>
                                <h2 className="net-pay-value">{formatCurrency(computed.netPay)}</h2>
                              </div>
                              <div>
                                <p className="net-pay-label">Status</p>
                                <span className={`status-badge ${status.className}`}>{status.label}</span>
                              </div>
                            </div>

                            <div className="breakdown-grid">
                              <div className="breakdown-card">
                                <h3 className="breakdown-title">Earnings</h3>
                                <div className="breakdown-row">
                                  <span>Basic</span>
                                  <input
                                    type="number"
                                    min="0"
                                    className="breakdown-input"
                                    value={row.basic}
                                    onChange={(e) => updateRow(emp._id, 'basic', sanitizeIntInput(e.target.value))}
                                  />
                                </div>
                                <div className="breakdown-row">
                                  <span>HRA</span>
                                  <input
                                    type="number"
                                    min="0"
                                    className="breakdown-input"
                                    value={row.hra}
                                    onChange={(e) => updateRow(emp._id, 'hra', sanitizeIntInput(e.target.value))}
                                  />
                                </div>
                                <div className="breakdown-row">
                                  <span>Special Allowance</span>
                                  <input
                                    type="number"
                                    min="0"
                                    className="breakdown-input"
                                    value={row.specialAllowance}
                                    onChange={(e) => updateRow(emp._id, 'specialAllowance', sanitizeIntInput(e.target.value))}
                                  />
                                </div>
                                <div className="breakdown-row">
                                  <span>
                                    Reimbursement
                                    {row.reimbursementClaims.length > 0 && (
                                      <button
                                        type="button"
                                        className="lop-why-link"
                                        onClick={() => toggleReimbursementBreakdown(emp._id)}
                                      >
                                        {row.reimbursementExpanded ? 'Hide claims' : 'Why?'}
                                      </button>
                                    )}
                                  </span>
                                  <span>{formatCurrency(row.reimbursement)}</span>
                                </div>
                                {row.reimbursementExpanded && row.reimbursementClaims.length > 0 && (
                                  <div className="lop-breakdown">
                                    {row.reimbursementClaims.map((claim) => (
                                      <div key={claim._id} className="lop-breakdown-row">
                                        <span>{new Date(claim.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        <span>{claim.expenseType}</span>
                                        <span className="claim-amount">{formatCurrency(claim.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {row.customEarnings.map((f) => (
                                  <div className="breakdown-row" key={f.name}>
                                    <span>{f.name}</span>
                                    <span>{formatCurrency(f.value)}</span>
                                  </div>
                                ))}
                                <div className="breakdown-row total-row">
                                  <span>Gross Earnings</span>
                                  <span>{formatCurrency(computed.grossEarnings)}</span>
                                </div>
                              </div>

                              <div className="breakdown-card">
                                <h3 className="breakdown-title">Deductions</h3>
                                <div className="breakdown-row">
                                  <span>PF (12% of basic)</span>
                                  <span className="negative">-{formatCurrency(computed.pf)}</span>
                                </div>
                                <div className="breakdown-row">
                                  <span>Professional Tax</span>
                                  <input
                                    type="number"
                                    min="0"
                                    className="breakdown-input"
                                    value={row.professionalTax}
                                    onChange={(e) => updateRow(emp._id, 'professionalTax', sanitizeIntInput(e.target.value))}
                                  />
                                </div>
                                <div className="breakdown-row">
                                  <span>TDS</span>
                                  <input
                                    type="number"
                                    min="0"
                                    className="breakdown-input"
                                    value={row.tds}
                                    onChange={(e) => updateRow(emp._id, 'tds', sanitizeIntInput(e.target.value))}
                                  />
                                </div>
                                <div className="breakdown-row">
                                  <span>
                                    LOP ({row.lopDays} days)
                                    {row.lopBreakdown.length > 0 && (
                                      <button
                                        type="button"
                                        className="lop-why-link"
                                        onClick={() => toggleLopBreakdown(emp._id)}
                                      >
                                        {row.lopExpanded ? 'Hide reason' : 'Why?'}
                                      </button>
                                    )}
                                  </span>
                                  <span className="negative">-{formatCurrency(computed.lopAmount)}</span>
                                </div>
                                {row.lopExpanded && row.lopBreakdown.length > 0 && (
                                  <div className="lop-breakdown">
                                    {row.lopBreakdown.map((b) => (
                                      <div key={b.date.toISOString()} className="lop-breakdown-row">
                                        <span>{b.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                                        <span>{LOP_TYPE_LABELS[b.type] || b.type}</span>
                                        <span>-{b.days} day{b.days !== 1 ? 's' : ''}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}
                                {row.customDeductions.map((f) => (
                                  <div className="breakdown-row" key={f.name}>
                                    <span>{f.name}</span>
                                    <span className="negative">-{formatCurrency(f.value)}</span>
                                  </div>
                                ))}
                                <div className="breakdown-row total-row">
                                  <span>Total deductions</span>
                                  <span className="negative">-{formatCurrency(computed.totalDeductions)}</span>
                                </div>
                              </div>
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
          <p className="no-records">No employees found</p>
        )}
      </div>

      <div className="claims-card">
        <h2 className="section-title">Reimbursement claims</h2>
        <div className="claims-tabs">
          {CLAIM_TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`claims-tab-btn ${claimsTab === tab.key ? 'active' : ''}`}
              onClick={() => setClaimsTab(tab.key)}
            >
              {tab.label} ({expenses.filter(tab.match).length})
            </button>
          ))}
        </div>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : (() => {
          const visibleClaims = expenses
            .filter(CLAIM_TABS.find((t) => t.key === claimsTab).match)
            .sort((a, b) => new Date(b.date) - new Date(a.date));

          return visibleClaims.length > 0 ? (
            <div className="claims-list">
              {visibleClaims.map((exp) => (
                <div key={exp._id} className="claim-row">
                  <div className="claim-main">
                    <p className="claim-title">
                      {exp.employeeId?.firstName} {exp.employeeId?.lastName} — {exp.expenseType} · ₹{exp.amount.toLocaleString('en-IN')}
                    </p>
                    <p className="claim-meta">
                      {exp.description} · {new Date(exp.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                    {exp.receipts && exp.receipts.length > 0 && (
                      <p className="claim-receipts">
                        {exp.receipts.map((url, idx) => (
                          <a key={url} href={`${FILE_BASE_URL}${url}`} target="_blank" rel="noreferrer">
                            📎 Receipt {exp.receipts.length > 1 ? idx + 1 : ''}
                          </a>
                        ))}
                      </p>
                    )}
                  </div>
                  {exp.status === 'submitted' ? (
                    <div className="claim-actions">
                      <button
                        className="claim-approve-btn"
                        disabled={claimActionId === exp._id}
                        onClick={() => handleClaimDecision(exp._id, 'approved')}
                        aria-label="Approve claim"
                      >
                        ✓
                      </button>
                      <button
                        className="claim-reject-btn"
                        disabled={claimActionId === exp._id}
                        onClick={() => handleClaimDecision(exp._id, 'rejected')}
                        aria-label="Reject claim"
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <span className={`status-badge ${exp.status}`}>
                      {CLAIM_STATUS_LABELS[exp.status] || exp.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="no-records">No {claimsTab === 'all' ? '' : claimsTab} claims</p>
          );
        })()}
      </div>

      <ConfirmDialog
        open={!!confirmState}
        message={confirmState?.message}
        confirmLabel={confirmState?.confirmLabel}
        onConfirm={confirmState?.onConfirm}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};

export default Payroll;
