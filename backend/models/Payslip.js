const mongoose = require('mongoose');

const payslipSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  month: {
    type: Number,
    required: [true, 'Month is required'],
    min: 1,
    max: 12
  },
  year: {
    type: Number,
    required: [true, 'Year is required']
  },
  earnings: {
    basic: { type: Number, required: [true, 'Basic salary is required'] },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 }
  },
  deductions: {
    pf: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 },
    lopDays: { type: Number, default: 0 },
    lopAmount: { type: Number, default: 0 }
  },
  grossSalary: {
    type: Number,
    required: true
  },
  totalDeductions: {
    type: Number,
    required: true
  },
  netSalary: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'processed', 'paid'],
    default: 'pending'
  },
  paymentDate: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

payslipSchema.index({ employeeId: 1, year: -1, month: -1 });

module.exports = mongoose.model('Payslip', payslipSchema);
