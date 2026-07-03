const Announcement = require('../models/Announcement');

// @desc    Get announcements
// @route   GET /api/announcements
// @access  Private
exports.getAnnouncements = async (req, res) => {
  try {
    const announcements = await Announcement.find({ isActive: true })
      .populate('postedBy', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, announcements });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Create announcement
// @route   POST /api/announcements
// @access  Private/Admin
exports.createAnnouncement = async (req, res) => {
  try {
    const { title, content, category, visibility, visibleTo, priority, attachments } = req.body;

    const announcement = await Announcement.create({
      title,
      content,
      category,
      postedBy: req.user.id,
      visibility,
      visibleTo,
      priority,
      attachments
    });

    res.status(201).json({ success: true, announcement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Update announcement
// @route   PUT /api/announcements/:id
// @access  Private/Admin
exports.updateAnnouncement = async (req, res) => {
  try {
    const { title, content, category, visibility, visibleTo, priority, isActive } = req.body;

    const announcement = await Announcement.findByIdAndUpdate(
      req.params.id,
      { title, content, category, visibility, visibleTo, priority, isActive },
      { new: true, runValidators: true }
    );

    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }

    res.status(200).json({ success: true, announcement });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Delete announcement
// @route   DELETE /api/announcements/:id
// @access  Private/Admin
exports.deleteAnnouncement = async (req, res) => {
  try {
    const announcement = await Announcement.findByIdAndDelete(req.params.id);
    if (!announcement) {
      return res.status(404).json({ success: false, message: 'Announcement not found' });
    }
    res.status(200).json({ success: true, message: 'Announcement deleted' });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
