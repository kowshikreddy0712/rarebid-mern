const mongoose = require('mongoose');

const bidSchema = new mongoose.Schema({
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', required: true, index: true },
  bidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  amount: { type: Number, required: true, min: 1 },
  acceptedAt: { type: Date, required: true, default: Date.now },
  requestKey: { type: String, required: true }
}, { timestamps: true });
bidSchema.index({ auction: 1, amount: -1, acceptedAt: 1 });
bidSchema.index({ bidder: 1, createdAt: -1 });
bidSchema.index({ bidder: 1, requestKey: 1 }, { unique: true });

module.exports = mongoose.model('Bid', bidSchema);
