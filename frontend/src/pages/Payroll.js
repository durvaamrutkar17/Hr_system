import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { userAPI, payslipAPI, expenseAPI } from '../services/api';
import useToast from '../hooks/useToast';
import Toast from '../components/Toast';
import './Payroll.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

const computeRow = (row) => {
  const gross = row.basic + row.hra + row.specialAllowance;
  const pf = Math.round(row.basic * 0.12);
  const lopAmount = row.lopDays > 0 ? Math.round((row.basic / 30) * row.lopDays) : 0;
  const otherDeductions = row.professionalTax + row.tds;
  const totalDeductions = pf + otherDeductions + lopAmount;
  const netPayout = gross - totalDeductions;
  return { gross, pf, otherDeductions, lopAmount, totalDeductions, netPayout };
};

const emptyRow = () => ({
  basic: 0, hra: 0, specialAllowance: 0, professionalTax: 0, tds: 0, lopDays: 0,
  processed: false, expanded: true
});

const Payroll = () => {
  const { user } = useAuth();
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState({});
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [claimActionId, setClaimActionId] = useState(null);
  const { message, showToast } = useToast();

  const today = new Date();
  const selectedMonth = today.getMonth() + 1;
  const selectedYear = today.getFullYear();

  useEffect(() => {
    fetchAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchAll = async () => {
    try {
      setLoading(true);
      const [usersRes, payslipsRes, expensesRes] = await Promise.all([
        userAPI.getUsers(),
        payslipAPI.getPayslips({}),
        expenseAPI.getExpenses({ status: 'submitted' })
      ]);

      const employeeList = usersRes.data.users || [];
      const allPayslips = payslipsRes.data.payslips || [];

      const nextRows = {};
      employeeList.forEach((emp) => {
        const empPayslips = allPayslips
          .filter((p) => (p.employeeId?._id || p.employeeId) === emp._id)
          .sort((a, b) => (b.year - a.year) || (b.month - a.month));

        const thisMonth = empPayslips.find((p) => p.month === selectedMonth && p.year === selectedYear);
        const latest = thisMonth || empPayslips[0];

        if (latest) {
          nextRows[emp._id] = {
            basic: latest.earnings.basic,
            hra: latest.earnings.hra,
            specialAllowance: latest.earnings.specialAllowance,
            professionalTax: latest.deductions.professionalTax,
            tds: latest.deductions.tds,
            lopDays: thisMonth ? thisMonth.deductions.lopDays : 0,
            processed: !!thisMonth,
            expanded: false
          };
        } else {
          nextRows[emp._id] = emptyRow();
        }
      });

      setEmployees(employeeList);
      setRows(nextRows);
      setExpenses(expensesRes.data.expenses || []);
    } catch (error) {
      console.error('Error loading payroll:', error);
    } finally {
      setLoading(false);
    }
  };

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

  const handleProcessPayroll = async () => {
    const missingBasic = employees.filter((emp) => !rows[emp._id]?.basic);
    if (missingBasic.length > 0) {
      showToast(
        'error',
        'Set a Basic salary for: ' +
        missingBasic.map((e) => `${e.firstName} ${e.lastName}`).join(', ') +
        ' before processing payroll.'
      );
      return;
    }

    if (!window.confirm(`Process payroll for ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}?`)) return;

    try {
      setProcessing(true);
      await Promise.all(employees.map((emp) => {
        const row = rows[emp._id];
        return payslipAPI.createPayslip({
          employeeId: emp._id,
          month: selectedMonth,
          year: selectedYear,
          earnings: { basic: row.basic, hra: row.hra, specialAllowance: row.specialAllowance },
          deductions: { professionalTax: row.professionalTax, tds: row.tds, lopDays: row.lopDays }
        });
      }));
      showToast('success', 'Payroll processed for ' + MONTH_NAMES[selectedMonth - 1]);
      fetchAll();
    } catch (error) {
      showToast('error', error.response?.data?.message || error.message);
    } finally {
      setProcessing(false);
    }
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

  return (
    <div className="payroll-page">
      <p className="eyebrow">Salary Run</p>
      <h1 className="page-title">Payroll — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}</h1>

      <Toast message={message} />

      <div className="calculator-card">
        <h2 className="section-title">Salary calculator</h2>

        {loading ? (
          <p className="loading-text">Loading employees...</p>
        ) : employees.length > 0 ? (
          <div className="payroll-list">
            {employees.map((emp) => {
              const row = rows[emp._id];
              if (!row) return null;
              const computed = computeRow(row);

              return (
                <div key={emp._id} className="payroll-row">
                  <div className="payroll-row-header">
                    <div>
                      <p className="emp-name">
                        {emp._id === user._id ? `You (${emp.firstName} ${emp.lastName})` : `${emp.firstName} ${emp.lastName}`}
                      </p>
                      <p className="emp-role">{emp.designation}</p>
                    </div>
                    {row.processed && <span className="processed-badge">Processed</span>}
                  </div>

                  <div className="payroll-figures">
                    <div className="figure">
                      <p className="figure-label">Gross</p>
                      <p className="figure-value">{formatCurrency(computed.gross)}</p>
                    </div>
                    <div className="figure">
                      <label className="figure-label" htmlFor={`lop-${emp._id}`}>LOP days</label>
                      <input
                        id={`lop-${emp._id}`}
                        type="number"
                        min="0"
                        max="31"
                        value={row.lopDays}
                        onChange={(e) => updateRow(emp._id, 'lopDays', Math.max(0, parseInt(e.target.value) || 0))}
                      />
                    </div>
                    <div className="figure">
                      <p className="figure-label">PF+PT+TDS</p>
                      <p className="figure-value negative">-{formatCurrency(computed.pf + computed.otherDeductions)}</p>
                    </div>
                    <div className="figure">
                      <p className="figure-label">Net payout</p>
                      <p className="figure-value net">{formatCurrency(computed.netPayout)}</p>
                    </div>
                  </div>

                  <button type="button" className="edit-toggle-btn" onClick={() => toggleExpanded(emp._id)}>
                    {row.expanded ? 'Hide salary structure' : 'Edit salary structure'}
                  </button>

                  {row.expanded && (
                    <div className="structure-form">
                      <div className="structure-group">
                        <label>Basic</label>
                        <input
                          type="number"
                          min="0"
                          value={row.basic}
                          onChange={(e) => updateRow(emp._id, 'basic', Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <div className="structure-group">
                        <label>HRA</label>
                        <input
                          type="number"
                          min="0"
                          value={row.hra}
                          onChange={(e) => updateRow(emp._id, 'hra', Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <div className="structure-group">
                        <label>Special Allowance</label>
                        <input
                          type="number"
                          min="0"
                          value={row.specialAllowance}
                          onChange={(e) => updateRow(emp._id, 'specialAllowance', Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <div className="structure-group">
                        <label>Professional Tax</label>
                        <input
                          type="number"
                          min="0"
                          value={row.professionalTax}
                          onChange={(e) => updateRow(emp._id, 'professionalTax', Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                      <div className="structure-group">
                        <label>TDS</label>
                        <input
                          type="number"
                          min="0"
                          value={row.tds}
                          onChange={(e) => updateRow(emp._id, 'tds', Math.max(0, parseInt(e.target.value) || 0))}
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <p className="no-records">No employees found</p>
        )}

        {!loading && employees.length > 0 && (
          <button className="process-btn" onClick={handleProcessPayroll} disabled={processing}>
            {processing ? 'Processing...' : `Process payroll for ${MONTH_NAMES[selectedMonth - 1]}`}
          </button>
        )}
      </div>

      <div className="claims-card">
        <h2 className="section-title">Reimbursement claims</h2>
        {loading ? (
          <p className="loading-text">Loading...</p>
        ) : expenses.length > 0 ? (
          <div className="claims-list">
            {expenses.map((exp) => (
              <div key={exp._id} className="claim-row">
                <div className="claim-main">
                  <p className="claim-title">
                    {exp.employeeId?.firstName} {exp.employeeId?.lastName} — {exp.expenseType} · ₹{exp.amount.toLocaleString('en-IN')}
                  </p>
                  <p className="claim-meta">{exp.description}</p>
                </div>
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
              </div>
            ))}
          </div>
        ) : (
          <p className="no-records">No pending claims</p>
        )}
      </div>
    </div>
  );
};

export default Payroll;
