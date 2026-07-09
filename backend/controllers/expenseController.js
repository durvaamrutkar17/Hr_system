const Expense = require('../models/Expense');

// @desc    Get expenses
// @route   GET /api/expenses
// @access  Private
exports.getExpenses = async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const query = {};

    if (employeeId) query.employeeId = employeeId;
    if (status) query.status = status;

    const expenses = await Expense.find(query)
      .populate('employeeId', 'firstName lastName email')
      .populate('approvedBy', 'firstName lastName');
    res.status(200).json({ success: true, expenses });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Create expense claim
// @route   POST /api/expenses
// @access  Private
exports.createExpense = async (req, res) => {
  try {
    const { expenseType, amount, currency, description, date } = req.body;
    const receipts = (req.files || []).map((file) => `/uploads/${file.filename}`);

    const expense = await Expense.create({
      employeeId: req.user.id,
      expenseType,
      amount,
      currency,
      description,
      date,
      receipts
    });

    res.status(201).json({ success: true, expense });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve/Reject expense
// @route   PUT /api/expenses/:id
// @access  Private/Admin
exports.updateExpense = async (req, res) => {
  try {
    const { status, approvalRemarks } = req.body;
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      {
        status,
        approvalRemarks,
        approvedBy: req.user.id,
        approvalDate: Date.now()
      },
      { new: true, runValidators: true }
    );

    if (!expense) {
      return res.status(404).json({ success: false, message: 'Expense not found' });
    }

    res.status(200).json({ success: true, expense });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
