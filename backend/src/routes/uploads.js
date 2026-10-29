const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const EvidenceDocument = require('../models/EvidenceDocument');
const Auction = require('../models/Auction');

const router = express.Router();
const publicUploadDir = path.resolve(__dirname, '../../uploads');
const privateUploadDir = path.resolve(__dirname, '../../private-uploads');
fs.mkdirSync(publicUploadDir, { recursive: true });
fs.mkdirSync(privateUploadDir, { recursive: true });
const imageTypes = new Map([
  ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp'], ['image/gif', '.gif']
]);
const evidenceTypes = new Map([
  ['application/pdf', '.pdf'], ['image/jpeg', '.jpg'], ['image/png', '.png'], ['image/webp', '.webp']
]);
function makeStorage(directory, typeMap) {
  return multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, directory),
    filename: (_req, file, cb) => cb(null, `${crypto.randomUUID()}${typeMap.get(file.mimetype) || '.bin'}`)
  });
}
const imageUpload = multer({
  storage: makeStorage(publicUploadDir, imageTypes),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => imageTypes.has(file.mimetype) ? cb(null, true) : cb(Object.assign(new Error('Upload a JPG, PNG, WEBP, or GIF image up to 5 MB.'), { status: 400 }))
});
const evidenceUpload = multer({
  storage: makeStorage(privateUploadDir, evidenceTypes),
  limits: { fileSize: 10 * 1024 * 1024, files: 5 },
  fileFilter: (_req, file, cb) => evidenceTypes.has(file.mimetype) ? cb(null, true) : cb(Object.assign(new Error('Evidence files must be PDF, JPG, PNG, or WEBP and no larger than 10 MB each.'), { status: 400 }))
});
function requireVerifiedSeller(req, res, next) {
  if (req.user.sellerVerificationStatus !== 'verified') return res.status(403).json({ message: 'Seller verification is required before uploading listing files.' });
  next();
}

router.post('/product-image', requireAuth, requireVerifiedSeller, (req, res, next) => {
  imageUpload.single('image')(req, res, error => {
    if (error) return next(error);
    if (!req.file) return res.status(400).json({ message: 'Choose a product image first.' });
    const base = (process.env.PUBLIC_API_URL || `http://localhost:${process.env.PORT || 5000}`).replace(/\/$/, '');
    res.status(201).json({ imageUrl: `${base}/uploads/${req.file.filename}`, filename: req.file.filename, size: req.file.size });
  });
});

router.post('/evidence-documents', requireAuth, requireVerifiedSeller, (req, res, next) => {
  evidenceUpload.array('documents', 5)(req, res, async error => {
    if (error) return next(error);
    try {
      if (!req.files?.length) return res.status(400).json({ message: 'Choose at least one evidence document.' });
      const docs = await EvidenceDocument.insertMany(req.files.map(file => ({
        owner: req.user.id,
        purpose: 'listing_evidence',
        storedName: file.filename,
        originalName: path.basename(file.originalname).slice(0, 180),
        mimeType: file.mimetype,
        size: file.size
      })));
      res.status(201).json({ documents: docs.map(doc => ({ id: String(doc._id), originalName: doc.originalName, mimeType: doc.mimeType, size: doc.size })) });
    } catch (uploadError) { next(uploadError); }
  });
});

router.post('/seller-verification-documents', requireAuth, (req, res, next) => {
  if (req.user.sellerVerificationStatus === 'verified') return res.status(409).json({ message: 'Your seller account is already verified.' });
  evidenceUpload.array('documents', 5)(req, res, async error => {
    if (error) return next(error);
    try {
      if (!req.files?.length) return res.status(400).json({ message: 'Choose at least one verification document.' });
      const docs = await EvidenceDocument.insertMany(req.files.map(file => ({ owner: req.user.id, purpose: 'seller_verification', storedName: file.filename, originalName: path.basename(file.originalname).slice(0, 180), mimeType: file.mimetype, size: file.size })));
      res.status(201).json({ documents: docs.map(doc => ({ id: String(doc._id), originalName: doc.originalName, mimeType: doc.mimeType, size: doc.size })) });
    } catch (uploadError) { next(uploadError); }
  });
});

// Evidence is private: only its owner, the listing's seller, or an administrator can download it.
router.get('/evidence-documents/:documentId', requireAuth, async (req, res, next) => {
  try {
    if (!/^[a-f\d]{24}$/i.test(req.params.documentId)) return res.status(400).json({ message: 'Invalid document ID.' });
    const doc = await EvidenceDocument.findById(req.params.documentId);
    if (!doc) return res.status(404).json({ message: 'Evidence document not found.' });
    let allowed = req.user.role === 'admin' || String(doc.owner) === String(req.user.id);
    if (!allowed && doc.auction) {
      const auction = await Auction.findById(doc.auction).select('seller');
      allowed = Boolean(auction && String(auction.seller) === String(req.user.id));
    }
    if (!allowed) return res.status(403).json({ message: 'You are not allowed to access this evidence document.' });
    const filePath = path.join(privateUploadDir, doc.storedName);
    if (!fs.existsSync(filePath)) return res.status(404).json({ message: 'Stored evidence file is unavailable.' });
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName.replace(/["\r\n]/g, '_')}"`);
    res.sendFile(filePath);
  } catch (error) { next(error); }
});
module.exports = router;
