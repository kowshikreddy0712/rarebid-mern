const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 80 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['user', 'admin'], default: 'user' },
  status: { type: String, enum: ['active', 'suspended'], default: 'active' },
  sellerVerificationStatus: {
    type: String,
    enum: ['not_submitted', 'pending', 'verified', 'rejected'],
    default: 'not_submitted'
  },
  sellerVerification: {
    fullLegalName: String,
    contactNote: String,
    evidenceReference: String,
    documentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'EvidenceDocument' }],
    submittedAt: Date,
    reviewedAt: Date,
    reviewNote: String
  }
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.sellerVerification;
    delete ret.__v;
    return ret;
  }
});

module.exports = mongoose.model('User', userSchema);
