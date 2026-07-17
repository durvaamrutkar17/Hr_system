// Shared with backend/models/Document.js and DocumentRequest.js - keep these
// two lists in sync with the enums there.

export const DOCUMENT_CATEGORIES = [
  'Recruitment', 'Joining', 'Identity', 'Payroll', 'Attendance', 'Leave',
  'Performance', 'Training', 'Assets', 'Compliance', 'Exit'
];

export const DOCUMENT_TYPES = [
  // specific types added by the Documents module redesign
  'Offer Letter', 'Appointment Letter', 'Salary Structure', 'Increment Letter',
  'Promotion Letter', 'Experience Letter', 'Relieving Letter', 'Payslips',
  'Form 16', 'NDA', 'Educational Certificates', 'PAN', 'Aadhaar', 'Passport',
  'Medical Certificate', 'Bank Details',
  // kept from the original Documents module
  'Resume', 'Certificate', 'ID Proof', 'Address Proof', 'Other'
];

export const isExpired = (expiryDate) => !!expiryDate && new Date(expiryDate) < new Date();

export const isExpiringSoon = (expiryDate, withinDays = 30) => {
  if (!expiryDate) return false;
  const days = (new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24);
  return days >= 0 && days <= withinDays;
};
