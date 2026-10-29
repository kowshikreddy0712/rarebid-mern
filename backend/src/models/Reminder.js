const mongoose = require('mongoose');
const reminderSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true },
  minutesBefore: { type: Number, enum: [1, 5, 15, 60, 1440], default: 5 },
  scheduledAt: { type: Date, required: true, index: true },
  sentAt: { type: Date, default: null, index: true }
}, { timestamps: true });
reminderSchema.index({ user: 1, auction: 1 }, { unique: true });
module.exports = mongoose.model('Reminder', reminderSchema);
