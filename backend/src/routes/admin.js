const express = require('express');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const User = require('../models/User');
const Auction = require('../models/Auction');
const Order = require('../models/Order');
const router = express.Router();
router.use(requireAuth, requireAdmin);

router.get('/overview', async (_req, res, next) => {
  try {
    const [users, pendingVerifications, pendingListings, liveAuctions, orders] = await Promise.all([
      User.countDocuments(), User.countDocuments({ sellerVerificationStatus: 'pending' }),
      Auction.countDocuments({ reviewStatus: 'pending' }), Auction.countDocuments({ reviewStatus: 'approved', status: 'live' }), Order.countDocuments()
    ]);
    res.json({ users, pendingVerifications, pendingListings, liveAuctions, orders });
  } catch (error) { next(error); }
});

router.get('/verifications', async (_req, res, next) => {
  try {
    const users = await User.find({ sellerVerificationStatus: 'pending' }).select('+sellerVerification').populate('sellerVerification.documentIds', 'originalName mimeType size').sort({ 'sellerVerification.submittedAt': 1 });
    res.json({ users: users.map(user => ({ ...user.toJSON(), sellerVerification: user.sellerVerification })) });
  } catch (error) { next(error); }
});

router.patch('/verifications/:userId', async (req, res, next) => {
  try {
    const decision = String(req.body.decision || '');
    if (!['verified', 'rejected'].includes(decision)) return res.status(400).json({ message: 'Decision must be verified or rejected.' });
    const user = await User.findById(req.params.userId).select('+sellerVerification');
    if (!user) return res.status(404).json({ message: 'User not found.' });
    if (user.sellerVerificationStatus !== 'pending') return res.status(409).json({ message: 'This verification request is no longer pending.' });
    user.sellerVerificationStatus = decision;
    user.sellerVerification.reviewedAt = new Date();
    user.sellerVerification.reviewNote = String(req.body.reviewNote || '').trim().slice(0, 1000);
    await user.save();
    res.json({ message: `Seller ${decision}.`, user: { id: user.id, name: user.name, sellerVerificationStatus: user.sellerVerificationStatus } });
  } catch (error) { next(error); }
});

router.get('/listings', async (_req, res, next) => {
  try {
    const auctions = await Auction.find({ reviewStatus: 'pending' }).sort({ createdAt: 1 }).populate('seller', 'name email sellerVerificationStatus').populate('evidenceDocuments', 'originalName mimeType size');
    res.json({ auctions });
  } catch (error) { next(error); }
});

router.patch('/listings/:auctionId', async (req, res, next) => {
  try {
    const decision = String(req.body.decision || '');
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ message: 'Decision must be approved or rejected.' });
    const auction = await Auction.findById(req.params.auctionId);
    if (!auction) return res.status(404).json({ message: 'Listing not found.' });
    if (auction.reviewStatus !== 'pending') return res.status(409).json({ message: 'This listing has already been reviewed.' });
    auction.reviewStatus = decision;
    auction.reviewNote = String(req.body.reviewNote || '').trim().slice(0, 1000);
    if (decision === 'approved' && auction.startAt <= new Date()) {
      auction.startAt = new Date(Date.now() + 60_000);
      auction.endAt = new Date(auction.startAt.getTime() + auction.durationMinutes * 60_000);
      auction.status = 'scheduled';
    }
    await auction.save();
    res.json({ message: `Listing ${decision}.`, auction });
  } catch (error) { next(error); }
});


router.patch('/listings/:auctionId/authenticity', async (req, res, next) => {
  try {
    const allowedStatuses = ['not_assessed', 'evidence_reviewed', 'specialist_authentication_pending', 'specialist_authenticated', 'unable_to_verify'];
    const authenticityStatus = String(req.body.authenticityStatus || '');
    if (!allowedStatuses.includes(authenticityStatus)) return res.status(400).json({ message: 'Choose a valid authenticity status.' });
    const auction = await Auction.findById(req.params.auctionId);
    if (!auction) return res.status(404).json({ message: 'Listing not found.' });
    auction.authenticityStatus = authenticityStatus;
    auction.authenticityReviewNote = String(req.body.authenticityReviewNote || '').trim().slice(0, 1000);
    auction.authenticityReviewedAt = new Date();
    await auction.save();
    res.json({ message: 'Authenticity review status updated.', auction: { id: auction.id, authenticityStatus: auction.authenticityStatus, authenticityReviewNote: auction.authenticityReviewNote, authenticityReviewedAt: auction.authenticityReviewedAt } });
  } catch (error) { next(error); }
});

router.get('/orders', async (_req, res, next) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 }).limit(200).populate('auction', 'title imageUrl').populate('buyer', 'name email').populate('seller', 'name email');
    res.json({ orders });
  } catch (error) { next(error); }
});

module.exports = router;
