export const PF_RATE = 0.12;

// Same payroll math used everywhere a salary figure is shown: manager's Payroll
// table, the actual processed Payslip (backend), and a live "not yet processed"
// estimate on the employee's own Salary page — kept in one place so they can't
// silently drift apart.
export const computeSalaryFigures = ({
  basic, hra, specialAllowance, professionalTax, tds, lopDays, reimbursement,
  customEarnings = 0, customDeductions = 0
}) => {
  const safeBasic = basic || 0;
  const gross = safeBasic + (hra || 0) + (specialAllowance || 0) + customEarnings;
  const pf = Math.round(safeBasic * PF_RATE);
  const lopAmount = lopDays > 0 ? Math.round((safeBasic / 30) * lopDays) : 0;
  const totalDeductions = pf + (professionalTax || 0) + (tds || 0) + lopAmount + customDeductions;
  const netPay = gross - totalDeductions + (reimbursement || 0);
  const grossEarnings = gross + (reimbursement || 0);
  return { gross, pf, lopAmount, totalDeductions, netPay, grossEarnings };
};

// Splits an employee's customSalaryFields ([{ name, value, type }]) into
// Earning/Deduction groups plus their totals, for both salary math and display.
export const splitCustomSalaryFields = (customSalaryFields) => {
  const list = Array.isArray(customSalaryFields) ? customSalaryFields : [];
  const earnings = list.filter((f) => f.type !== 'deduction');
  const deductions = list.filter((f) => f.type === 'deduction');
  const earningsTotal = earnings.reduce((sum, f) => sum + (Number(f.value) || 0), 0);
  const deductionsTotal = deductions.reduce((sum, f) => sum + (Number(f.value) || 0), 0);
  return { earnings, deductions, earningsTotal, deductionsTotal };
};
