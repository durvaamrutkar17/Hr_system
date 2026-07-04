import React, { useState, useEffect } from 'react';
import jsPDF from 'jspdf';
import { payslipAPI, expenseAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './Salary.css';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

const formatCurrency = (value) => `₹${Math.round(value).toLocaleString('en-IN')}`;

const getStatusLabel = (paymentStatus) =>
  paymentStatus === 'paid'
    ? { label: 'Paid', className: 'paid' }
    : { label: 'Processing', className: 'processing' };

const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

const twoDigitsToWords = (n) => {
  if (n < 20) return ONES[n];
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${TENS[tens]}${ones ? '-' + ONES[ones] : ''}`;
};

const threeDigitsToWords = (n) => {
  const hundred = Math.floor(n / 100);
  const rest = n % 100;
  let str = '';
  if (hundred) str += `${ONES[hundred]} Hundred`;
  if (rest) str += `${str ? ' ' : ''}${twoDigitsToWords(rest)}`;
  return str;
};

const numberToWords = (value) => {
  let num = Math.round(value);
  if (num === 0) return 'Zero';

  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const hundred = num;

  const parts = [];
  if (crore) parts.push(`${threeDigitsToWords(crore)} Crore`);
  if (lakh) parts.push(`${threeDigitsToWords(lakh)} Lakh`);
  if (thousand) parts.push(`${threeDigitsToWords(thousand)} Thousand`);
  if (hundred) parts.push(threeDigitsToWords(hundred));

  return parts.join(' ');
};

const amountInWords = (value) => `Indian Rupee ${numberToWords(value)} Only`;

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
    // jsPDF's standard fonts don't include the ₹ glyph — it corrupts the whole string when rendered,
    // so the PDF uses a plain "Rs." prefix instead (on-screen display still uses formatCurrency/₹)
    const formatCurrencyPdf = (value) => `Rs. ${Math.round(value).toLocaleString('en-IN')}`;
    const monthLabel = `${MONTH_NAMES[payslip.month - 1]} ${payslip.year}`;

    const left = 14;
    const right = 196;
    const mid = 108;
    const teal = [27, 77, 77];
    const dark = [40, 40, 40];
    const gray = [130, 130, 130];
    const negative = [192, 57, 43];
    const tintGreen = [234, 246, 234];
    const tintTeal = [238, 245, 245];
    const tintGray = [246, 246, 246];

    const reimbursement = getReimbursementsFor(payslip.month, payslip.year);
    const grossEarnings = payslip.grossSalary + reimbursement;
    const totalDeductions = payslip.totalDeductions;
    const totalNetPayable = grossEarnings - totalDeductions;

    const daysInMonth = new Date(payslip.year, payslip.month, 0).getDate();
    const lopDays = payslip.deductions.lopDays || 0;
    const paidDays = daysInMonth - lopDays;
    const employeeId = user._id.slice(-6).toUpperCase();
    const payDate = payslip.paymentDate
      ? new Date(payslip.paymentDate).toLocaleDateString('en-GB')
      : '—';

    const doc = new jsPDF();

    // Header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(...teal);
    doc.text('HealthismPlus Technologies Pvt Ltd', left, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text('HR & Payroll Portal', left, 26);

    doc.setFontSize(9);
    doc.text('Payslip For the Month', right, 17, { align: 'right' });
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...teal);
    doc.text(monthLabel, right, 24, { align: 'right' });

    doc.setDrawColor(220);
    doc.line(left, 32, right, 32);

    // Employee summary (left) + Net pay card (right)
    const summaryTop = 42;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text('EMPLOYEE SUMMARY', left, summaryTop);

    const summaryRows = [
      ['Employee Name', `${user.firstName} ${user.lastName}`],
      ['Employee ID', employeeId],
      ['Designation', user.designation || '—'],
      ['Pay Period', monthLabel],
      ['Pay Date', payDate]
    ];
    doc.setFontSize(10);
    summaryRows.forEach(([label, value], idx) => {
      const rowY = summaryTop + 7 + idx * 6.5;
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...gray);
      doc.text(label, left, rowY);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...dark);
      doc.text(`: ${value}`, left + 32, rowY);
    });

    const cardX = 128;
    const cardW = right - cardX;
    const cardY = summaryTop - 2;
    const cardH = 42;
    doc.setFillColor(...tintGreen);
    doc.setDrawColor(...teal);
    doc.roundedRect(cardX, cardY, cardW, cardH, 2, 2, 'FD');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(...teal);
    doc.text(formatCurrencyPdf(totalNetPayable), cardX + 4, cardY + 10);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...gray);
    doc.text('Total Net Pay', cardX + 4, cardY + 15);

    doc.setDrawColor(200);
    doc.line(cardX + 4, cardY + 20, cardX + cardW - 4, cardY + 20);

    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text('Paid Days', cardX + 4, cardY + 27);
    doc.text('LOP Days', cardX + 4, cardY + 34);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text(String(paidDays), cardX + cardW - 4, cardY + 27, { align: 'right' });
    doc.text(String(lopDays), cardX + cardW - 4, cardY + 34, { align: 'right' });

    // Earnings / Deductions table
    const tableTop = summaryTop + cardH + 6;
    const earningsRows = [
      ['Basic', formatCurrencyPdf(payslip.earnings.basic)],
      ['House Rent Allowance', formatCurrencyPdf(payslip.earnings.hra)],
      ['Special Allowance', formatCurrencyPdf(payslip.earnings.specialAllowance)],
      ['Reimbursement', formatCurrencyPdf(reimbursement)]
    ];
    const deductionRows = [
      ['Income Tax (TDS)', formatCurrencyPdf(payslip.deductions.tds)],
      ['Provident Fund', formatCurrencyPdf(payslip.deductions.pf)],
      ['Professional Tax', formatCurrencyPdf(payslip.deductions.professionalTax)],
      [`LOP (${lopDays} days)`, formatCurrencyPdf(payslip.deductions.lopAmount)]
    ];
    const rowCount = Math.max(earningsRows.length, deductionRows.length);
    const rowH = 7;
    const headerH = 9;
    const totalRowH = 9;
    const tableH = headerH + rowCount * rowH + totalRowH;

    doc.setFillColor(...tintTeal);
    doc.rect(left, tableTop, right - left, headerH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(...teal);
    doc.text('EARNINGS', left + 3, tableTop + 6);
    doc.text('AMOUNT', mid - 3, tableTop + 6, { align: 'right' });
    doc.text('DEDUCTIONS', mid + 3, tableTop + 6);
    doc.text('AMOUNT', right - 3, tableTop + 6, { align: 'right' });

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(...dark);
    for (let i = 0; i < rowCount; i += 1) {
      const rowY = tableTop + headerH + i * rowH + 5;
      if (earningsRows[i]) {
        doc.text(earningsRows[i][0], left + 3, rowY);
        doc.text(earningsRows[i][1], mid - 3, rowY, { align: 'right' });
      }
      if (deductionRows[i]) {
        doc.text(deductionRows[i][0], mid + 3, rowY);
        doc.text(deductionRows[i][1], right - 3, rowY, { align: 'right' });
      }
    }

    const totalRowY = tableTop + headerH + rowCount * rowH;
    doc.setFillColor(...tintGray);
    doc.rect(left, totalRowY, right - left, totalRowH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...dark);
    doc.text('Gross Earnings', left + 3, totalRowY + 6);
    doc.text(formatCurrencyPdf(grossEarnings), mid - 3, totalRowY + 6, { align: 'right' });
    doc.setTextColor(...negative);
    doc.text('Total Deductions', mid + 3, totalRowY + 6);
    doc.text(formatCurrencyPdf(totalDeductions), right - 3, totalRowY + 6, { align: 'right' });

    doc.setDrawColor(200);
    doc.rect(left, tableTop, right - left, tableH, 'S');
    doc.line(mid, tableTop, mid, tableTop + tableH);
    doc.line(left, tableTop + headerH, right, tableTop + headerH);
    doc.line(left, totalRowY, right, totalRowY);

    // Total net payable bar
    const payableY = tableTop + tableH + 8;
    doc.setFillColor(...tintGreen);
    doc.rect(left, payableY, right - left, 16, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...dark);
    doc.text('TOTAL NET PAYABLE', left + 4, payableY + 7);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('Gross Earnings - Total Deductions', left + 4, payableY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(13);
    doc.setTextColor(...teal);
    doc.text(formatCurrencyPdf(totalNetPayable), right - 4, payableY + 10, { align: 'right' });

    // Amount in words
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...gray);
    doc.text(`Amount In Words: ${amountInWords(totalNetPayable)}`, 105, payableY + 26, { align: 'center' });

    // Footer
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(...gray);
    doc.text('-- This is a system-generated document. --', 105, payableY + 36, { align: 'center' });

    doc.save(`Payslip-${monthLabel.replace(' ', '-')}.pdf`);
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
                          <td className="net-cell">{formatCurrency(p.netSalary)}</td>
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
