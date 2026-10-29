const mongoose = require('mongoose');
const orderSchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true, unique: true },
  buyer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  winningBidAmount: { type: Number, required: true },
  currency: { type: String, default: 'INR' },
  paymentStatus: { type: String, enum: ['awaiting_payment', 'paid', 'failed', 'refunded'], default: 'awaiting_payment' },
  fulfillmentStatus: { type: String, enum: ['awaiting_fulfillment', 'shipped', 'delivered', 'disputed', 'completed'], default: 'awaiting_fulfillment' },
  paymentDueAt: Date,
  paymentGatewayOrderId: { type: String, default: null, index: true },
  paymentId: { type: String, default: null },
  paidAt: Date,
  trackingCarrier: String,
  trackingNumber: String,
  shippingNote: String,
  winnerContactEmailSentAt: { type: Date, default: null },
  winnerContactEmailClaimedAt: { type: Date, default: null },
  winnerContactEmailLastAttemptAt: { type: Date, default: null },
  winnerContactEmailError: { type: String, maxlength: 500 }
}, { timestamps: true });
module.exports = mongoose.model('Order', orderSchema);
