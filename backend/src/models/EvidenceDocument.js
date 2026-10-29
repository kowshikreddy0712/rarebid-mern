const mongoose = require('mongoose');
const evidenceDocumentSchema = new mongoose.Schema({
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  auction: { type: mongoose.Schema.Types.ObjectId, ref: 'Auction', default: null, index: true },
  purpose: { type: String, enum: ['listing_evidence', 'seller_verification'], default: 'listing_evidence', index: true },
  storedName: { type: String, required: true, unique: true },
  originalName: { type: String, required: true, maxlength: 180 },
  mimeType: { type: String, required: true },
  size: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
module.exports = mongoose.model('EvidenceDocument', evidenceDocumentSchema);
