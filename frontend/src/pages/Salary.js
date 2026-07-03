import React, { useState, useEffect } from 'react';
import { payslipAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Salary.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const Salary = () => {
  const { user } = useAuth();
  const [payslips, setPayslips] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPayslips();
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

  const handleDownload = (payslip) => {
    const monthLabel = `${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`;
    const lines = [
      `HealthismPlus - Payslip for ${monthLabel}`,
      `Employee: ${user.firstName} ${user.lastName}`,
      '',
      'EARNINGS',
      `Basic${' '.repeat(24)}${formatCurrency(payslip.earnings.basic)}`,
      `HRA${' '.repeat(26)}${formatCurrency(payslip.earnings.hra)}`,
      `Special Allowance${' '.repeat(11)}${formatCurrency(payslip.earnings.specialAllowance)}`,
      `Gross${' '.repeat(24)}${formatCurrency(payslip.grossSalary)}`,
      '',
      'DEDUCTIONS',
      `PF (12% of basic)${' '.repeat(11)}-${formatCurrency(payslip.deductions.pf)}`,
      `Professional Tax${' '.repeat(12)}-${formatCurrency(payslip.deductions.professionalTax)}`,
      `TDS${' '.repeat(26)}-${formatCurrency(payslip.deductions.tds)}`,
      `LOP (${payslip.deductions.lopDays} days)${' '.repeat(17)}-${formatCurrency(payslip.deductions.lopAmount)}`,
      `Total deductions${' '.repeat(12)}-${formatCurrency(payslip.totalDeductions)}`,
      '',
      `NET PAY${' '.repeat(22)}${formatCurrency(payslip.netSalary)}`
    ];

    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Payslip-${monthLabel.replace(' ', '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const latest = payslips[0];

  return (
    <div className="salary-page">
      <p className="eyebrow">Payroll</p>
      <h1 className="page-title">Salary</h1>

      {loading ? (
        <p className="loading-text">Loading payslips...</p>
      ) : latest ? (
        <>
          <div className="net-pay-card">
            <div>
              <p className="net-pay-label">
                Net pay · {MONTH_NAMES[latest.month - 1]} {latest.year}
              </p>
              <h2 className="net-pay-value">{formatCurrency(latest.netSalary)}</h2>
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

          {payslips.length > 1 && (
            <div className="history-card">
              <h3 className="breakdown-title">Payslip history</h3>
              <div className="history-list">
                {payslips.map((p) => (
                  <div key={p._id} className="history-row">
                    <span>{MONTH_NAMES[p.month - 1]} {p.year}</span>
                    <span>{formatCurrency(p.netSalary)}</span>
                    <button className="history-download-btn" onClick={() => handleDownload(p)}>
                      Download
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="no-payslips">
          <p>No payslips available yet</p>
        </div>
      )}
    </div>
  );
};

export default Salary;
