const mongoose = require('mongoose');

// Represents a pending "please join HealthismPlus" invite sent by an
// Admin/HR user (see controllers/authController.js inviteUser). No User
// document is created until the invitee sets their password via
// POST /api/auth/invite/:token/setup-password, so an outstanding invite
// never shows up as an employee anywhere in the app.
const invitationSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    lowercase: true,
    trim: true
  },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: { type: String },
  designation: { type: String },
  department: { type: String },
  dateOfJoining: { type: Date },
  role: {
    type: String,
    enum: ['employee', 'manager', 'admin'],
    default: 'employee'
  },
  organizationLevel: {
    type: String,
    enum: ['CEO', 'Vice President', 'Department Head', 'Manager', 'Team Lead', 'Employee', 'HR', 'Admin'],
    default: 'Employee'
  },
  reportsTo: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  manager: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  teamLead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  departmentHead: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  vp: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  employmentType: {
    type: String,
    enum: ['Full-Time', 'Part-Time', 'Contract', 'Intern', 'Consultant'],
    default: 'Full-Time'
  },
  token: {
    type: String,
    required: true,
    unique: true
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'accepted', 'expired', 'revoked'],
    default: 'pending'
  },
  expiresAt: {
    type: Date,
    required: true
  },
  acceptedAt: {
    type: Date
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

invitationSchema.index({ email: 1, status: 1 });

module.exports = mongoose.model('Invitation', invitationSchema);
