export const PF_RATE = 0.12;

// Same payroll math used everywhere a salary figure is shown: manager's Payroll
// table, the actual processed Payslip (backend), and a live "not yet processed"
// estimate on the employee's own Salary page — kept in one place so they can't
// silently drift apart.
export const computeSalaryFigures = ({ basic, hra, specialAllowance, professionalTax, tds, lopDays, reimbursement }) => {
  const safeBasic = basic || 0;
  const gross = safeBasic + (hra || 0) + (specialAllowance || 0);
  const pf = Math.round(safeBasic * PF_RATE);
  const lopAmount = lopDays > 0 ? Math.round((safeBasic / 30) * lopDays) : 0;
  const totalDeductions = pf + (professionalTax || 0) + (tds || 0) + lopAmount;
  const netPay = gross - totalDeductions + (reimbursement || 0);
  const grossEarnings = gross + (reimbursement || 0);
  return { gross, pf, lopAmount, totalDeductions, netPay, grossEarnings };
};
