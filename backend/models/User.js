const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  firstName: {
    type: String,
    required: [true, 'First name is required'],
    trim: true
  },
  lastName: {
    type: String,
    required: [true, 'Last name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    match: [/^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/, 'Please provide a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: 6,
    select: false
  },
  phone: {
    type: String,
    required: [true, 'Phone is required']
  },
  designation: {
    type: String,
    required: [true, 'Designation is required']
  },
  department: {
    type: String,
    required: [true, 'Department is required']
  },
  dateOfJoining: {
    type: Date,
    required: [true, 'Date of joining is required']
  },
  role: {
    type: String,
    enum: ['employee', 'manager', 'admin'],
    default: 'employee'
  },
  reportingManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  profileImage: {
    type: String,
    default: null
  },
  workMode: {
    type: String,
    enum: ['WFO', 'WFH', 'Hybrid'],
    default: 'WFO'
  },
  casualLeaveBalance: {
    type: Number,
    default: 6
  },
  sickLeaveBalance: {
    type: Number,
    default: 5
  },
  earnedLeaveBalance: {
    type: Number,
    default: 9
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'resigned'],
    default: 'active'
  },
  salaryStructure: {
    basic: { type: Number, default: 0 },
    hra: { type: Number, default: 0 },
    specialAllowance: { type: Number, default: 0 },
    professionalTax: { type: Number, default: 0 },
    tds: { type: Number, default: 0 }
  },
  customSalaryFields: {
    type: [{
      name: { type: String, required: true, trim: true },
      value: { type: Number, default: 0 },
      type: { type: String, enum: ['earning', 'deduction'], default: 'earning' }
    }],
    default: []
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) {
    next();
  }
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
});

// Match password
userSchema.methods.matchPassword = async function(enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
