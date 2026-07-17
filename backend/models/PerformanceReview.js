const mongoose = require('mongoose');

// A single performance review entry for an employee. Multiple reviews can
// exist per employee (one per period), shown newest-first on the "Performance"
// tab of the Employee Profile page.
const performanceReviewSchema = new mongoose.Schema({
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  reviewPeriod: {
    type: String,
    required: [true, 'Review period is required'],
    trim: true
  },
  rating: {
    type: Number,
    required: [true, 'Rating is required'],
    min: 1,
    max: 5
  },
  strengths: { type: String, trim: true },
  areasForImprovement: { type: String, trim: true },
  goals: { type: String, trim: true },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'submitted', 'acknowledged'],
    default: 'submitted'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

performanceReviewSchema.index({ employeeId: 1, createdAt: -1 });

module.exports = mongoose.model('PerformanceReview', performanceReviewSchema);
