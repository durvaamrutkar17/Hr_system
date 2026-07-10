import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { payslipAPI, expenseAPI, attendanceAPI, leaveAPI, flexHoursAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { downloadPayslipPdf } from '../utils/payslipPdf';
import { buildMonthAttendanceRows, computeLopBreakdown } from '../utils/attendanceCalendar';
import { computeSalaryFigures } from '../utils/salaryCalc';
import './Salary.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const LOP_TYPE_LABELS = {
  absent: 'Absent',
  'half-day': 'Half Day',
  'unpaid-leave': 'Unpaid leave'
};

const formatCurrency = (value) => `₹${Math.round(value || 0).toLocaleString('en-IN')}`;

const getStatusLabel = (paymentStatus) =>
  paymentStatus === 'paid'
    ? { label: 'Paid', className: 'paid' }
    : { label: 'Processing', className: 'processing' };

const SalaryDetail = () => {
  const { month, year } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const monthNum = Number(month);
  const yearNum = Number(year);

  const [loading, setLoading] = useState(true);
  const [payslip, setPayslip] = useState(null);
  const [estimate, setEstimate] = useState(null);
  const [lopBreakdown, setLopBreakdown] = useState([]);
  const [reimbursementClaims, setReimbursementClaims] = useState([]);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const [payslipsRes, expensesRes, attendanceRes, leavesRes, flexRes] = await Promise.all([
          payslipAPI.getPayslips({ employeeId: user._id }),
          expenseAPI.getExpenses({ employeeId: user._id }),
          attendanceAPI.getAttendance({ employeeId: user._id, month: monthNum, year: yearNum }),
          leaveAPI.getEmployeeLeaves(user._id),
          flexHoursAPI.getFlexHoursRequests({ employeeId: user._id })
        ]);

        const claims = (expensesRes.data.expenses || []).filter((e) => {
          if (e.status !== 'approved' && e.status !== 'reimbursed') return false;
          const d = new Date(e.date);
          return d.getMonth() + 1 === monthNum && d.getFullYear() === yearNum;
        });
        setReimbursementClaims(claims);

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
          month: monthNum,
          year: yearNum
        });
        const { lopDays, breakdown } = computeLopBreakdown(rows, appliedFlexByDate);
        setLopBreakdown(breakdown);

        const match = (payslipsRes.data.payslips || []).find((p) => p.month === monthNum && p.year === yearNum);

        if (match) {
          setPayslip(match);
          setEstimate(null);
        } else {
          setPayslip(null);
          const today = new Date();
          const isCurrentMonth = monthNum === today.getMonth() + 1 && yearNum === today.getFullYear();
          if (isCurrentMonth) {
            const salaryStructure = user.salaryStructure || {};
            const reimbursement = claims.reduce((sum, e) => sum + e.amount, 0);
            const figures = computeSalaryFigures({
              basic: salaryStructure.basic,
              hra: salaryStructure.hra,
              specialAllowance: salaryStructure.specialAllowance,
              professionalTax: salaryStructure.professionalTax,
              tds: salaryStructure.tds,
              lopDays,
              reimbursement
            });
            setEstimate({
              basic: salaryStructure.basic || 0,
              hra: salaryStructure.hra || 0,
              specialAllowance: salaryStructure.specialAllowance || 0,
              professionalTax: salaryStructure.professionalTax || 0,
              tds: salaryStructure.tds || 0,
              lopDays,
              reimbursement,
              ...figures
            });
          } else {
            setEstimate(null);
          }
        }
      } catch (error) {
        console.error('Error loading salary detail:', error);
      } finally {
        setLoading(false);
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [monthNum, yearNum, user._id]);

  const reimbursement = reimbursementClaims.reduce((sum, e) => sum + e.amount, 0);
  const basic = payslip ? payslip.earnings.basic : estimate?.basic || 0;
  const dailyRate = basic / 30;

  const handleDownload = () => {
    if (!payslip) return;
    downloadPayslipPdf({
      payslip,
      employeeName: `${user.firstName} ${user.lastName}`,
      designation: user.designation,
      employeeIdStr: user._id.slice(-6).toUpperCase(),
      reimbursement
    });
  };

  const status = payslip ? getStatusLabel(payslip.paymentStatus) : null;

  return (
    <div className="salary-page">
      <button type="button" className="salary-back-btn" onClick={() => navigate('/salary')}>
        ← Back to Salary
      </button>
      <p className="eyebrow">Payroll</p>
      <h1 className="page-title">{MONTH_NAMES[monthNum - 1]} {yearNum}</h1>

      {loading ? (
        <p className="loading-text">Loading...</p>
      ) : !payslip && !estimate ? (
        <p className="loading-text">No salary data available for this month</p>
      ) : (
        <>
          <div className={`net-pay-card ${estimate ? 'estimate-card' : ''}`}>
            <div>
              <p className="net-pay-label">
                {estimate ? 'Estimated net pay' : 'Net pay'} · {MONTH_NAMES[monthNum - 1]} {yearNum}
              </p>
              <h2 className="net-pay-value">
                {formatCurrency(estimate ? estimate.netPay : payslip.netSalary + reimbursement)}
              </h2>
              {estimate && (
                <p className="estimate-note">Calculated automatically from your attendance so far — not yet processed by your manager</p>
              )}
            </div>
            {estimate ? (
              <span className="status-badge estimate">Estimated</span>
            ) : (
              <>
                {status && <span className={`status-badge ${status.className}`}>{status.label}</span>}
                <button className="download-btn" onClick={handleDownload}>
                  ⬇ Download payslip
                </button>
              </>
            )}
          </div>

          <div className="breakdown-grid">
            <div className="breakdown-card">
              <h3 className="breakdown-title">Earnings</h3>
              <div className="breakdown-row">
                <span>Basic</span>
                <span>{formatCurrency(payslip ? payslip.earnings.basic : estimate.basic)}</span>
              </div>
              <div className="breakdown-row">
                <span>HRA</span>
                <span>{formatCurrency(payslip ? payslip.earnings.hra : estimate.hra)}</span>
              </div>
              <div className="breakdown-row">
                <span>Special Allowance</span>
                <span>{formatCurrency(payslip ? payslip.earnings.specialAllowance : estimate.specialAllowance)}</span>
              </div>
              <div className="breakdown-row">
                <span>Reimbursement</span>
                <span>{formatCurrency(reimbursement)}</span>
              </div>
              {reimbursementClaims.length > 0 && (
                <div className="lop-breakdown">
                  {reimbursementClaims.map((claim) => (
                    <div key={claim._id} className="lop-breakdown-row">
                      <span>{new Date(claim.date).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span>{claim.expenseType}</span>
                      <span className="claim-amount">{formatCurrency(claim.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="breakdown-row total-row">
                <span>Gross Earnings</span>
                <span>
                  {formatCurrency(payslip ? payslip.grossSalary + reimbursement : estimate.grossEarnings)}
                </span>
              </div>
            </div>

            <div className="breakdown-card">
              <h3 className="breakdown-title">Deductions</h3>
              <div className="breakdown-row">
                <span>PF (12% of basic)</span>
                <span className="negative">-{formatCurrency(payslip ? payslip.deductions.pf : estimate.pf)}</span>
              </div>
              <div className="breakdown-row">
                <span>Professional Tax</span>
                <span className="negative">-{formatCurrency(payslip ? payslip.deductions.professionalTax : estimate.professionalTax)}</span>
              </div>
              <div className="breakdown-row">
                <span>TDS</span>
                <span className="negative">-{formatCurrency(payslip ? payslip.deductions.tds : estimate.tds)}</span>
              </div>
              <div className="breakdown-row">
                <span>LOP ({payslip ? payslip.deductions.lopDays : estimate.lopDays} days)</span>
                <span className="negative">-{formatCurrency(payslip ? payslip.deductions.lopAmount : estimate.lopAmount)}</span>
              </div>
              {lopBreakdown.length > 0 && (
                <div className="lop-breakdown">
                  {lopBreakdown.map((b) => (
                    <div key={b.date.toISOString()} className="lop-breakdown-row">
                      <span>{b.date.toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                      <span>{LOP_TYPE_LABELS[b.type] || b.type}</span>
                      <span>-{formatCurrency(dailyRate * b.days)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="breakdown-row total-row">
                <span>Total deductions</span>
                <span className="negative">
                  -{formatCurrency(payslip ? payslip.totalDeductions : estimate.totalDeductions)}
                </span>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SalaryDetail;
