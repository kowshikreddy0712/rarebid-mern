const mongoose = require('mongoose');
const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: { type: String, enum: ['auction_start', 'auction_ended', 'auction_won', 'payment_deadline', 'order_paid', 'system'], default: 'system' },
  message: { type: String, required: true, maxlength: 500 },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null },
  readAt: { type: Date, default: null, index: true }
}, { timestamps: true });
notificationSchema.index({ user: 1, createdAt: -1 });
module.exports = mongoose.model('Notification', notificationSchema);
