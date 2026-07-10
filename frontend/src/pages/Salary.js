import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { payslipAPI, expenseAPI, attendanceAPI, leaveAPI, flexHoursAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { downloadPayslipPdf } from '../utils/payslipPdf';
import { buildMonthAttendanceRows, computeLopBreakdown } from '../utils/attendanceCalendar';
import { computeSalaryFigures, splitCustomSalaryFields } from '../utils/salaryCalc';
import './Salary.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const getStatusLabel = (paymentStatus) =>
  paymentStatus === 'paid'
    ? { label: 'Paid', className: 'paid' }
    : { label: 'Processing', className: 'processing' };

const Salary = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [payslips, setPayslips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [estimate, setEstimate] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  useEffect(() => {
    fetchPayslips();
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // If this month hasn't been processed yet, calculate a live estimate from the
  // employee's salary structure + attendance so far, rather than showing nothing
  // until a manager runs payroll.
  useEffect(() => {
    if (loading) return;

    const today = new Date();
    const month = today.getMonth() + 1;
    const year = today.getFullYear();
    const alreadyProcessed = payslips.some((p) => p.month === month && p.year === year);

    if (alreadyProcessed) {
      setEstimate(null);
      return;
    }

    const fetchEstimate = async () => {
      try {
        setLoadingEstimate(true);
        const [attendanceRes, leavesRes, flexRes] = await Promise.all([
          attendanceAPI.getAttendance({ employeeId: user._id, month, year }),
          leaveAPI.getEmployeeLeaves(user._id),
          flexHoursAPI.getFlexHoursRequests({ employeeId: user._id })
        ]);

        const appliedFlexByDate = (flexRes.data.requests || [])
          .filter((r) => r.status !== 'rejected')
          .reduce((acc, r) => {
            const key = new Date(r.date).toDateString();
            acc[key] = (acc[key] || 0) + r.hoursRequested;
            return acc;
          }, {});

        const rows = buildMonthAttendanceRows({
          dateOfJoining: user.dateOfJoining,
          attendance: attendanceRes.data.attendance || [],
          leaves: leavesRes.data.leaves || [],
          month,
          year
        });

        const { lopDays, breakdown } = computeLopBreakdown(rows, appliedFlexByDate);
        const reimbursementClaims = getReimbursementClaimsFor(month, year);
        const reimbursement = reimbursementClaims.reduce((sum, e) => sum + e.amount, 0);
        const salaryStructure = user.salaryStructure || {};
        const { earningsTotal: customEarningsTotal, deductionsTotal: customDeductionsTotal } =
          splitCustomSalaryFields(user.customSalaryFields);

        const figures = computeSalaryFigures({
          basic: salaryStructure.basic,
          hra: salaryStructure.hra,
          specialAllowance: salaryStructure.specialAllowance,
          professionalTax: salaryStructure.professionalTax,
          tds: salaryStructure.tds,
          lopDays,
          reimbursement,
          customEarnings: customEarningsTotal,
          customDeductions: customDeductionsTotal
        });

        setEstimate({
          month,
          year,
          basic: salaryStructure.basic || 0,
          hra: salaryStructure.hra || 0,
          specialAllowance: salaryStructure.specialAllowance || 0,
          professionalTax: salaryStructure.professionalTax || 0,
          tds: salaryStructure.tds || 0,
          lopDays,
          lopBreakdown: breakdown,
          reimbursement,
          reimbursementClaims,
          ...figures
        });
      } catch (error) {
        console.error('Error computing salary estimate:', error);
      } finally {
        setLoadingEstimate(false);
      }
    };

    fetchEstimate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, payslips]);

  const fetchPayslips = async () => {
    try {
      setLoading(true);
      const response = await payslipAPI.getPayslips({ employeeId: user._id });
      setPayslips(response.data.payslips || []);
    } catch (error) {
      console.error('Error fetching payslips:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const response = await expenseAPI.getExpenses({ employeeId: user._id });
      setExpenses(response.data.expenses || []);
    } catch (error) {
      console.error('Error fetching expenses:', error);
    }
  };

  const getReimbursementClaimsFor = (month, year) =>
    expenses.filter((e) => {
      if (e.status !== 'approved' && e.status !== 'reimbursed') return false;
      const d = new Date(e.date);
      return d.getMonth() + 1 === month && d.getFullYear() === year;
    });

  const getReimbursementsFor = (month, year) =>
    getReimbursementClaimsFor(month, year).reduce((sum, e) => sum + e.amount, 0);

  const handleDownload = (payslip) => {
    downloadPayslipPdf({
      payslip,
      employeeName: `${user.firstName} ${user.lastName}`,
      designation: user.designation,
      employeeIdStr: user._id.slice(-6).toUpperCase(),
      reimbursement: getReimbursementsFor(payslip.month, payslip.year)
    });
  };

  const latest = payslips[0];
  const latestReimbursement = latest ? getReimbursementsFor(latest.month, latest.year) : 0;

  return (
    <div className="salary-page">
      <p className="eyebrow">Payroll</p>
      <h1 className="page-title">Salary</h1>

      {loading ? (
        <p className="loading-text">Loading payslips...</p>
      ) : (
        <>
          {loadingEstimate && <p className="loading-text">Calculating this month's salary...</p>}

          {estimate && (
            <div
              className="net-pay-card estimate-card salary-card-link"
              onClick={() => navigate(`/salary/${estimate.month}/${estimate.year}`)}
            >
              <div>
                <p className="net-pay-label">
                  Estimated net pay · {MONTH_NAMES[estimate.month - 1]} {estimate.year}
                </p>
                <h2 className="net-pay-value">{formatCurrency(estimate.netPay)}</h2>
                <p className="estimate-note">Calculated automatically from your attendance so far — not yet processed by your manager</p>
              </div>
              <span className="status-badge estimate">Estimated</span>
            </div>
          )}

          {latest && (
            <div
              className="net-pay-card salary-card-link"
              onClick={() => navigate(`/salary/${latest.month}/${latest.year}`)}
            >
              <div>
                <p className="net-pay-label">
                  Net pay · {MONTH_NAMES[latest.month - 1]} {latest.year}
                </p>
                <h2 className="net-pay-value">
                  {formatCurrency(latest.netSalary + latestReimbursement)}
                </h2>
              </div>
              <button
                className="download-btn"
                onClick={(e) => { e.stopPropagation(); handleDownload(latest); }}
              >
                ⬇ Download payslip
              </button>
            </div>
          )}

          <div className="history-card">
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
                  {payslips.length > 0 ? (
                    payslips.map((p) => {
                      const reimbursement = getReimbursementsFor(p.month, p.year);
                      const status = getStatusLabel(p.paymentStatus);

                      return (
                        <tr
                          key={p._id}
                          className="salary-row-link"
                          onClick={() => navigate(`/salary/${p.month}/${p.year}`)}
                        >
                          <td>{MONTH_NAMES[p.month - 1]} {p.year}</td>
                          <td>{formatCurrency(p.grossSalary)}</td>
                          <td className="negative">-{formatCurrency(p.totalDeductions)}</td>
                          <td>{reimbursement > 0 ? formatCurrency(reimbursement) : '-'}</td>
                          <td className="net-cell">{formatCurrency(p.netSalary + reimbursement)}</td>
                          <td>
                            {status && <span className={`status-badge ${status.className}`}>{status.label}</span>}
                          </td>
                          <td>
                            <button
                              className="history-download-btn"
                              onClick={(e) => { e.stopPropagation(); handleDownload(p); }}
                            >
                              ⬇ Download
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={7} className="no-records-cell">No payslips available yet</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default Salary;
