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

const LOP_TYPE_LABELS = {
  absent: 'Absent',
  'half-day': 'Half Day',
  'unpaid-leave': 'Unpaid leave'
};

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
  const [lopBreakdown, setLopBreakdown] = useState([]);
  const [showLopBreakdown, setShowLopBreakdown] = useState(false);
  const [showReimbursementBreakdown, setShowReimbursementBreakdown] = useState(false);
  const [estimate, setEstimate] = useState(null);
  const [loadingEstimate, setLoadingEstimate] = useState(false);

  useEffect(() => {
    fetchPayslips();
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const latest = payslips[0];
    if (!latest) {
      setLopBreakdown([]);
      return;
    }

    const fetchLopBreakdown = async () => {
      try {
        const [attendanceRes, leavesRes, flexRes] = await Promise.all([
          attendanceAPI.getAttendance({ employeeId: user._id, month: latest.month, year: latest.year }),
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
          month: latest.month,
          year: latest.year
        });

        setLopBreakdown(computeLopBreakdown(rows, appliedFlexByDate).breakdown);
      } catch (error) {
        console.error('Error computing LOP breakdown:', error);
      }
    };

    fetchLopBreakdown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payslips]);

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
        const {
          earnings: customEarnings,
          deductions: customDeductions,
          earningsTotal: customEarningsTotal,
          deductionsTotal: customDeductionsTotal
        } = splitCustomSalaryFields(user.customSalaryFields);

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
          customEarnings,
          customDeductions,
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
  const latestReimbursementClaims = latest ? getReimbursementClaimsFor(latest.month, latest.year) : [];

  // A payslip for the month still in progress was processed against attendance
  // as of that moment — absences since then wouldn't show up unless someone
  // reprocesses it. Swap in the live LOP figure for the ongoing month so the
  // deduction actually reflects today's attendance, same as the breakdown list
  // below it already does.
  const today = new Date();
  const latestIsOngoingMonth = !!latest && latest.month === today.getMonth() + 1 && latest.year === today.getFullYear();
  const liveLopDays = lopBreakdown.reduce((sum, b) => sum + b.days, 0);
  const liveLopAmount = liveLopDays > 0 && latest ? Math.round((latest.earnings.basic / 30) * liveLopDays) : 0;
  const displayLopDays = latestIsOngoingMonth ? liveLopDays : (latest?.deductions.lopDays || 0);
  const displayLopAmount = latestIsOngoingMonth ? liveLopAmount : (latest?.deductions.lopAmount || 0);
  const lopAdjustment = displayLopAmount - (latest?.deductions.lopAmount || 0);
  const displayTotalDeductions = (latest?.totalDeductions || 0) + lopAdjustment;
  const displayNetSalary = (latest?.netSalary || 0) - lopAdjustment;

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
            <>
              <div className="net-pay-card estimate-card">
                <div>
                  <p className="net-pay-label">
                    Estimated net pay · {MONTH_NAMES[estimate.month - 1]} {estimate.year}
                  </p>
                  <h2 className="net-pay-value">{formatCurrency(estimate.netPay)}</h2>
                  <p className="estimate-note">Calculated automatically from your attendance so far — not yet processed by your manager</p>
                </div>
                <span className="status-badge estimate">Estimated</span>
              </div>

              <div className="breakdown-grid">
                <div className="breakdown-card">
                  <h3 className="breakdown-title">Earnings</h3>
                  <div className="breakdown-row">
                    <span>Basic</span>
                    <span>{formatCurrency(estimate.basic)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>HRA</span>
                    <span>{formatCurrency(estimate.hra)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Special Allowance</span>
                    <span>{formatCurrency(estimate.specialAllowance)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Reimbursement</span>
                    <span>{formatCurrency(estimate.reimbursement)}</span>
                  </div>
                  {estimate.customEarnings.map((f) => (
                    <div className="breakdown-row" key={f.name}>
                      <span>{f.name}</span>
                      <span>{formatCurrency(f.value)}</span>
                    </div>
                  ))}
                  <div className="breakdown-row total-row">
                    <span>Gross Earnings</span>
                    <span>{formatCurrency(estimate.grossEarnings)}</span>
                  </div>
                </div>

                <div className="breakdown-card">
                  <h3 className="breakdown-title">Deductions</h3>
                  <div className="breakdown-row">
                    <span>PF (12% of basic)</span>
                    <span className="negative">-{formatCurrency(estimate.pf)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Professional Tax</span>
                    <span className="negative">-{formatCurrency(estimate.professionalTax)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>TDS</span>
                    <span className="negative">-{formatCurrency(estimate.tds)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>LOP ({estimate.lopDays} days)</span>
                    <span className="negative">-{formatCurrency(estimate.lopAmount)}</span>
                  </div>
                  {estimate.lopBreakdown.length > 0 && (
                    <div className="lop-breakdown">
                      {estimate.lopBreakdown.map((b) => (
                        <div key={b.date.toISOString()} className="lop-breakdown-row">
                          <span>{b.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span>{LOP_TYPE_LABELS[b.type] || b.type}</span>
                          <span>-{formatCurrency((estimate.basic / 30) * b.days)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {estimate.customDeductions.map((f) => (
                    <div className="breakdown-row" key={f.name}>
                      <span>{f.name}</span>
                      <span className="negative">-{formatCurrency(f.value)}</span>
                    </div>
                  ))}
                  <div className="breakdown-row total-row">
                    <span>Total deductions</span>
                    <span className="negative">-{formatCurrency(estimate.totalDeductions)}</span>
                  </div>
                </div>
              </div>
            </>
          )}

          {latest && (
            <>
              <div className="net-pay-card">
                <div>
                  <p className="net-pay-label">
                    Net pay · {MONTH_NAMES[latest.month - 1]} {latest.year}
                  </p>
                  <h2 className="net-pay-value">
                    {formatCurrency(displayNetSalary + latestReimbursement)}
                  </h2>
                </div>
                <button className="download-btn" onClick={() => handleDownload(latest)}>
                  ⬇ Download payslip
                </button>
              </div>

              <div className="breakdown-grid">
                <div className="breakdown-card">
                  <h3 className="breakdown-title">Earnings</h3>
                  <div className="breakdown-row">
                    <span>Basic</span>
                    <span>{formatCurrency(latest.earnings.basic)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>HRA</span>
                    <span>{formatCurrency(latest.earnings.hra)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Special Allowance</span>
                    <span>{formatCurrency(latest.earnings.specialAllowance)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>
                      Reimbursement
                      {latestReimbursementClaims.length > 0 && (
                        <button
                          type="button"
                          className="lop-why-link"
                          onClick={() => setShowReimbursementBreakdown((prev) => !prev)}
                        >
                          {showReimbursementBreakdown ? 'Hide claims' : 'Why?'}
                        </button>
                      )}
                    </span>
                    <span>{formatCurrency(latestReimbursement)}</span>
                  </div>
                  {showReimbursementBreakdown && latestReimbursementClaims.length > 0 && (
                    <div className="lop-breakdown">
                      {latestReimbursementClaims.map((claim) => (
                        <div key={claim._id} className="lop-breakdown-row">
                          <span>{new Date(claim.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span>{claim.expenseType}</span>
                          <span className="claim-amount">{formatCurrency(claim.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(latest.earnings.custom || []).map((f) => (
                    <div className="breakdown-row" key={f.name}>
                      <span>{f.name}</span>
                      <span>{formatCurrency(f.value)}</span>
                    </div>
                  ))}
                  <div className="breakdown-row total-row">
                    <span>Gross Earnings</span>
                    <span>{formatCurrency(latest.grossSalary + latestReimbursement)}</span>
                  </div>
                </div>

                <div className="breakdown-card">
                  <h3 className="breakdown-title">Deductions</h3>
                  <div className="breakdown-row">
                    <span>PF (12% of basic)</span>
                    <span className="negative">-{formatCurrency(latest.deductions.pf)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>Professional Tax</span>
                    <span className="negative">-{formatCurrency(latest.deductions.professionalTax)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>TDS</span>
                    <span className="negative">-{formatCurrency(latest.deductions.tds)}</span>
                  </div>
                  <div className="breakdown-row">
                    <span>
                      LOP ({displayLopDays} days)
                      {lopBreakdown.length > 0 && (
                        <button
                          type="button"
                          className="lop-why-link"
                          onClick={() => setShowLopBreakdown((prev) => !prev)}
                        >
                          {showLopBreakdown ? 'Hide reason' : 'Why?'}
                        </button>
                      )}
                    </span>
                    <span className="negative">-{formatCurrency(displayLopAmount)}</span>
                  </div>
                  {showLopBreakdown && lopBreakdown.length > 0 && (
                    <div className="lop-breakdown">
                      {lopBreakdown.map((b) => (
                        <div key={b.date.toISOString()} className="lop-breakdown-row">
                          <span>{b.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                          <span>{LOP_TYPE_LABELS[b.type] || b.type}</span>
                          <span>-{formatCurrency((latest.earnings.basic / 30) * b.days)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {(latest.deductions.custom || []).map((f) => (
                    <div className="breakdown-row" key={f.name}>
                      <span>{f.name}</span>
                      <span className="negative">-{formatCurrency(f.value)}</span>
                    </div>
                  ))}
                  <div className="breakdown-row total-row">
                    <span>Total deductions</span>
                    <span className="negative">-{formatCurrency(displayTotalDeductions)}</span>
                  </div>
                </div>
              </div>
            </>
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
                      const isOngoing = p._id === latest?._id && latestIsOngoingMonth;
                      const rowTotalDeductions = isOngoing ? displayTotalDeductions : p.totalDeductions;
                      const rowNetSalary = isOngoing ? displayNetSalary : p.netSalary;

                      return (
                        <tr
                          key={p._id}
                          className="salary-row-link"
                          onClick={() => navigate(`/salary/${p.month}/${p.year}`)}
                        >
                          <td>{MONTH_NAMES[p.month - 1]} {p.year}</td>
                          <td>{formatCurrency(p.grossSalary)}</td>
                          <td className="negative">-{formatCurrency(rowTotalDeductions)}</td>
                          <td>{reimbursement > 0 ? formatCurrency(reimbursement) : '-'}</td>
                          <td className="net-cell">{formatCurrency(rowNetSalary + reimbursement)}</td>
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
