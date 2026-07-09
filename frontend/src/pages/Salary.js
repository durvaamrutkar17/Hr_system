import React, { useState, useEffect } from 'react';
import { payslipAPI, expenseAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { downloadPayslipPdf } from '../utils/payslipPdf';
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
  const [payslips, setPayslips] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayslips();
    fetchExpenses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  const getReimbursementsFor = (month, year) =>
    expenses
      .filter((e) => {
        if (e.status !== 'approved' && e.status !== 'reimbursed') return false;
        const d = new Date(e.date);
        return d.getMonth() + 1 === month && d.getFullYear() === year;
      })
      .reduce((sum, e) => sum + e.amount, 0);

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

  return (
    <div className="salary-page">
      <p className="eyebrow">Payroll</p>
      <h1 className="page-title">Salary</h1>

      {loading ? (
        <p className="loading-text">Loading payslips...</p>
      ) : (
        <>
          {latest && (
            <>
              <div className="net-pay-card">
                <div>
                  <p className="net-pay-label">
                    Net pay · {MONTH_NAMES[latest.month - 1]} {latest.year}
                  </p>
                  <h2 className="net-pay-value">
                    {formatCurrency(latest.netSalary + getReimbursementsFor(latest.month, latest.year))}
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
                  <div className="breakdown-row total-row">
                    <span>Gross</span>
                    <span>{formatCurrency(latest.grossSalary)}</span>
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
                    <span>LOP ({latest.deductions.lopDays} days)</span>
                    <span className="negative">-{formatCurrency(latest.deductions.lopAmount)}</span>
                  </div>
                  <div className="breakdown-row total-row">
                    <span>Total deductions</span>
                    <span className="negative">-{formatCurrency(latest.totalDeductions)}</span>
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
                            <button className="history-download-btn" onClick={() => handleDownload(p)}>
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
