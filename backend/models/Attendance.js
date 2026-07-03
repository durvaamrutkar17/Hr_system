const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  checkInTime: {
    type: Date,
    required: true
  },
  checkOutTime: Date,
  reason: String // required for any session after the first one that day
}, { _id: false });

const attendanceSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: Date,
    required: [true, 'Date is required']
  },
  checkInTime: Date,
  checkOutTime: Date,
  workMode: {
    type: String,
    enum: ['WFO', 'WFH'],
    required: [true, 'Work mode is required']
  },
  status: {
    type: String,
    enum: ['present', 'absent', 'half-day', 'on-leave'],
    default: 'absent'
  },
  hoursWorked: {
    type: Number,
    default: 0
  },
  sessions: [sessionSchema],
  remarks: String,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Index for quick querying
attendanceSchema.index({ employeeId: 1, date: 1 });

module.exports = mongoose.model('Attendance', attendanceSchema);
