const mongoose = require('mongoose');

const auctionSchema = new mongoose.Schema({
  title: { type: String, required: true, trim: true, minlength: 4, maxlength: 120 },
  description: { type: String, required: true, trim: true, minlength: 20, maxlength: 5000 },
  category: { type: String, required: true, enum: ['Vehicles', 'Gold & Treasures', 'Antiques', 'Art', 'Coins', 'Collectibles', 'Books', 'Watches', 'Memorabilia', 'Militaria', 'Other'] },
  condition: { type: String, required: true, enum: ['New', 'Excellent', 'Good', 'Fair', 'For parts / restoration'] },
  imageUrl: { type: String, required: true, trim: true },
  evidenceDescription: { type: String, trim: true, maxlength: 2000 },
  evidenceDocuments: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceDocument' }],
  seller: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  reviewStatus: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending', index: true },
  reviewNote: { type: String, maxlength: 1000 },
  authenticityStatus: { type: String, enum: ['not_assessed', 'evidence_reviewed', 'specialist_authentication_pending', 'specialist_authenticated', 'unable_to_verify'], default: 'not_assessed', index: true },
  authenticityReviewNote: { type: String, maxlength: 1000 },
  authenticityReviewedAt: Date,
  startingPrice: { type: Number, required: true, min: 1 },
  currentPrice: { type: Number, required: true, min: 1 },
  minIncrement: { type: Number, required: true, min: 1, default: 100 },
  durationMinutes: { type: Number, required: true, enum: [1, 2, 5, 10, 15, 30, 60] },
  startAt: { type: Date, required: true, index: true },
  endAt: { type: Date, required: true, index: true },
  status: { type: String, enum: ['scheduled', 'live', 'ended', 'cancelled'], default: 'scheduled', index: true },
  bidCount: { type: Number, default: 0 },
  highestBidder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  winner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  closedAt: Date,
  orderCreated: { type: Boolean, default: false },
  shippingInfo: { type: String, trim: true, maxlength: 1000 }
}, { timestamps: true });

auctionSchema.index({ reviewStatus: 1, status: 1, startAt: 1 });
auctionSchema.index({ category: 1, currentPrice: 1 });
auctionSchema.index({ title: 'text', description: 'text', category: 'text' });

module.exports = mongoose.model('Auction', auctionSchema);
