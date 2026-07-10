const mongoose = require('mongoose');

const expenseSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  expenseType: {
    type: String,
    enum: ['Travel', 'Food', 'Accommodation', 'Medical', 'Other'],
    required: [true, 'Expense type is required']
  },
  amount: {
    type: Number,
    required: [true, 'Amount is required']
  },
  currency: {
    type: String,
    default: 'INR'
  },
  description: {
    type: String,
    required: [true, 'Description is required']
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  receipts: [String], // URLs or file paths
  status: {
    type: String,
    enum: ['submitted', 'approved', 'rejected', 'reimbursed'],
    default: 'submitted'
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  approvalDate: Date,
  approvalRemarks: String,
  reimbursementDate: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

expenseSchema.index({ employeeId: 1, date: -1 });

module.exports = mongoose.model('Expense', expenseSchema);
