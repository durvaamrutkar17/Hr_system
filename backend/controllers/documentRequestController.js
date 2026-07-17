const DocumentRequest = require('../models/DocumentRequest');
const { isReviewer } = require('../permissions/permissionEngine');

// @desc    Get document requests (self-scoped for plain employees, same
//          pattern as assetController/attendanceController: a reviewer sees
//          everyone's requests, optionally filtered by employeeId; a plain
//          employee only ever sees their own)
// @route   GET /api/documents/requests
// @access  Private
exports.getDocumentRequests = async (req, res) => {
  try {
    const { employeeId, status } = req.query;
    const query = {};

    if (isReviewer(req.user)) {
      if (employeeId) query.employeeId = employeeId;
    } else {
      // A plain employee only ever sees their own requests, regardless of
      // what employeeId they pass in.
      query.employeeId = req.user.id;
    }
    if (status) query.status = status;

    const requests = await DocumentRequest.find(query)
      .sort({ createdAt: -1 })
      .populate('employeeId', 'firstName lastName')
      .populate('reviewedBy', 'firstName lastName')
      .populate('fulfillingDocumentId', 'fileName fileUrl');

    res.status(200).json({ success: true, requests });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Ask HR to issue an official document
// @route   POST /api/documents/requests
// @access  Private
exports.createDocumentRequest = async (req, res) => {
  try {
    const { documentCategory, documentType, reason } = req.body;

    if (!documentCategory || !documentType) {
      return res.status(400).json({ success: false, message: 'documentCategory and documentType are required' });
    }

    const request = await DocumentRequest.create({
      employeeId: req.user.id,
      documentCategory,
      documentType,
      reason
    });

    res.status(201).json({ success: true, request });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

// @desc    Approve or reject a document request
// @route   PATCH /api/documents/requests/:id
// @access  Private/Admin/HR (canManageDocumentRequests)
exports.updateDocumentRequest = async (req, res) => {
  try {
    const { status, reviewRemarks } = req.body;
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'status must be approved or rejected' });
    }

    const request = await DocumentRequest.findById(req.params.id);
    if (!request) {
      return res.status(404).json({ success: false, message: 'Request not found' });
    }

    request.status = status;
    request.reviewRemarks = reviewRemarks;
    request.reviewedBy = req.user.id;
    request.reviewedAt = new Date();
    await request.save();

    res.status(200).json({ success: true, request });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
