const Holiday = require('../models/Holiday');

// @desc    Get holidays
// @route   GET /api/holidays
// @access  Private
exports.getHolidays = async (req, res) => {
  try {
    const holidays = await Holiday.find().sort({ date: 1 });
    res.status(200).json({ success: true, holidays });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Create holiday
// @route   POST /api/holidays
// @access  Private/Admin
exports.createHoliday = async (req, res) => {
  try {
    const { name, date, type, description, isOptional } = req.body;

    const holiday = await Holiday.create({
      name,
      date,
      type,
      description,
      isOptional
    });

    res.status(201).json({ success: true, holiday });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update holiday
// @route   PUT /api/holidays/:id
// @access  Private/Admin
exports.updateHoliday = async (req, res) => {
  try {
    const { name, date, type, description, isOptional } = req.body;

    const holiday = await Holiday.findByIdAndUpdate(
      req.params.id,
      { name, date, type, description, isOptional, updatedAt: Date.now() },
      { new: true, runValidators: true }
    );

    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }

    res.status(200).json({ success: true, holiday });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete holiday
// @route   DELETE /api/holidays/:id
// @access  Private/Admin
exports.deleteHoliday = async (req, res) => {
  try {
    const holiday = await Holiday.findByIdAndDelete(req.params.id);
    if (!holiday) {
      return res.status(404).json({ success: false, message: 'Holiday not found' });
    }
    res.status(200).json({ success: true, message: 'Holiday deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
