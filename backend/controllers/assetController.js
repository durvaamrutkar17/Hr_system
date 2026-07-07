const Asset = require('../models/Asset');

// @desc    Get assets
// @route   GET /api/assets
// @access  Private
exports.getAssets = async (req, res) => {
  try {
    const { employeeId } = req.query;
    const query = {};

    if (employeeId) {
      query.employeeId = employeeId;
    } else if (req.user.role === 'employee') {
      query.employeeId = req.user.id;
    }

    const assets = await Asset.find(query)
      .populate('employeeId', 'firstName lastName')
      .sort({ createdAt: -1 });
    res.status(200).json({ success: true, assets });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Assign a new asset
// @route   POST /api/assets
// @access  Private/Manager/Admin
exports.createAsset = async (req, res) => {
  try {
    const { employeeId, itemName, serialNumber } = req.body;

    const asset = await Asset.create({
      employeeId,
      itemName,
      serialNumber
    });

    const populated = await asset.populate('employeeId', 'firstName lastName');
    res.status(201).json({ success: true, asset: populated });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Mark an asset returned
// @route   PUT /api/assets/:id
// @access  Private/Manager/Admin
exports.updateAsset = async (req, res) => {
  try {
    const { status } = req.body;

    const asset = await Asset.findByIdAndUpdate(
      req.params.id,
      { status, returnedDate: status === 'returned' ? Date.now() : undefined },
      { new: true, runValidators: true }
    ).populate('employeeId', 'firstName lastName');

    if (!asset) {
      return res.status(404).json({ success: false, message: 'Asset not found' });
    }

    res.status(200).json({ success: true, asset });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
