const PerformanceReview = require('../models/PerformanceReview');

// @desc    Get all performance reviews for one employee (newest first) - used
//          by the "Performance" tab of the Employee Profile page.
// @route   GET /api/performance/employee/:id
// @access  Private (self or reviewer - see permissions/permissionEngine.js canViewPerformance)
exports.getEmployeePerformance = async (req, res) => {
  try {
    const reviews = await PerformanceReview.find({ employeeId: req.params.id })
      .sort({ createdAt: -1 })
      .populate('reviewedBy', 'firstName lastName designation');

    res.status(200).json({ success: true, reviews });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Create a performance review for an employee
// @route   POST /api/performance
// @access  Private/Manager/Admin (canManagePerformance)
exports.createPerformanceReview = async (req, res) => {
  try {
    const { employeeId, reviewPeriod, rating, strengths, areasForImprovement, goals, status } = req.body;

    if (!employeeId || !reviewPeriod || !rating) {
      return res.status(400).json({ success: false, message: 'employeeId, reviewPeriod and rating are required' });
    }

    const review = await PerformanceReview.create({
      employeeId,
      reviewPeriod,
      rating,
      strengths,
      areasForImprovement,
      goals,
      status: ['draft', 'submitted', 'acknowledged'].includes(status) ? status : 'submitted',
      reviewedBy: req.user.id
    });

    const populated = await review.populate('reviewedBy', 'firstName lastName designation');

    res.status(201).json({ success: true, review: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
