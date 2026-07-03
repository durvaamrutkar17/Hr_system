const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Holiday name is required']
  },
  date: {
    type: Date,
    required: [true, 'Holiday date is required']
  },
  type: {
    type: String,
    enum: ['National', 'Regional', 'Company'],
    default: 'National'
  },
  description: String,
  isOptional: {
    type: Boolean,
    default: false
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

module.exports = mongoose.model('Holiday', holidaySchema);
