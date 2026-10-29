const express = require('express');
const { requireAuth } = require('../middleware/auth');
const User = require('../models/User');
const Watchlist = require('../models/Watchlist');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Order = require('../models/Order');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const EvidenceDocument = require('../models/EvidenceDocument');
const router = express.Router();

router.post('/seller-verification', requireAuth, async (req, res, next) => {
  try {
    if (req.user.sellerVerificationStatus === 'verified') return res.status(409).json({ message: 'Your seller account is already verified.' });
    const fullLegalName = String(req.body.fullLegalName || '').trim();
    const contactNote = String(req.body.contactNote || '').trim();
    const evidenceReference = String(req.body.evidenceReference || '').trim();
    const documentIds = req.body.documentIds || [];
    if (fullLegalName.length < 3 || evidenceReference.length < 8) return res.status(400).json({ message: 'Provide your legal name and a reference to your verification evidence.' });
    if (!Array.isArray(documentIds) || documentIds.length > 5 || documentIds.some(id => !require('mongoose').isValidObjectId(id))) return res.status(400).json({ message: 'Verification document references are invalid.' });
    const documents = documentIds.length ? await EvidenceDocument.find({ _id: { $in: documentIds }, owner: req.user.id, auction: null, purpose: 'seller_verification' }) : [];
    if (documents.length !== documentIds.length) return res.status(400).json({ message: 'One or more verification documents are unavailable or do not belong to your account.' });
    req.user.sellerVerification = { fullLegalName, contactNote, evidenceReference, documentIds: documents.map(doc => doc._id), submittedAt: new Date() };
    req.user.sellerVerificationStatus = 'pending';
    await req.user.save();
    res.status(201).json({ message: 'Verification request submitted for administrator review.', status: req.user.sellerVerificationStatus });
  } catch (error) { next(error); }
});

router.get('/watchlist', requireAuth, async (req, res, next) => {
  try {
    const saved = await Watchlist.find({ user: req.user.id }).sort({ createdAt: -1 }).populate({ path: 'auction', populate: { path: 'seller', select: 'name sellerVerificationStatus' } });
    res.json({ auctions: saved.map(item => item.auction).filter(Boolean) });
  } catch (error) { next(error); }
});

router.post('/watchlist/:auctionId', requireAuth, async (req, res, next) => {
  try {
    const auction = await Auction.findOne({ _id: req.params.auctionId, reviewStatus: 'approved' });
    if (!auction) return res.status(404).json({ message: 'Auction not found.' });
    await Watchlist.updateOne({ user: req.user.id, auction: auction.id }, { $setOnInsert: { user: req.user.id, auction: auction.id } }, { upsert: true });
    res.json({ saved: true });
  } catch (error) { next(error); }
});

router.delete('/watchlist/:auctionId', requireAuth, async (req, res, next) => {
  try {
    await Watchlist.deleteOne({ user: req.user.id, auction: req.params.auctionId });
    res.json({ saved: false });
  } catch (error) { next(error); }
});


router.get('/reminders', requireAuth, async (req, res, next) => {
  try {
    const reminders = await Reminder.find({ user: req.user.id }).sort({ scheduledAt: 1 }).populate('auction', 'title imageUrl startAt status endAt');
    res.json({ reminders: reminders.filter(item => item.auction && item.auction.endAt > new Date()) });
  } catch (error) { next(error); }
});

router.post('/reminders/:auctionId', requireAuth, async (req, res, next) => {
  try {
    const auction = await Auction.findOne({ _id: req.params.auctionId, reviewStatus: 'approved' });
    if (!auction) return res.status(404).json({ message: 'Auction not found.' });
    if (auction.status === 'ended' || auction.endAt <= new Date()) return res.status(400).json({ message: 'This auction has already ended.' });
    if (auction.startAt <= new Date()) return res.status(400).json({ message: 'This auction has already started; use the watchlist to follow it.' });
    const allowed = [1, 5, 15, 60, 1440];
    const minutesBefore = allowed.includes(Number(req.body.minutesBefore)) ? Number(req.body.minutesBefore) : 5;
    const scheduledAt = new Date(Math.max(Date.now(), auction.startAt.getTime() - minutesBefore * 60_000));
    const reminder = await Reminder.findOneAndUpdate(
      { user: req.user.id, auction: auction.id },
      { $set: { minutesBefore, scheduledAt, sentAt: null }, $setOnInsert: { user: req.user.id, auction: auction.id } },
      { upsert: true, new: true, runValidators: true }
    );
    res.status(201).json({ reminder, message: 'Auction reminder set.' });
  } catch (error) { next(error); }
});

router.delete('/reminders/:auctionId', requireAuth, async (req, res, next) => {
  try {
    await Reminder.deleteOne({ user: req.user.id, auction: req.params.auctionId });
    res.json({ reminderSet: false });
  } catch (error) { next(error); }
});

router.get('/notifications', requireAuth, async (req, res, next) => {
  try {
    const notifications = await Notification.find({ user: req.user.id }).sort({ createdAt: -1 }).limit(100).populate('auction', 'title imageUrl status');
    const unreadCount = await Notification.countDocuments({ user: req.user.id, readAt: null });
    res.json({ notifications, unreadCount });
  } catch (error) { next(error); }
});

router.patch('/notifications/read-all', requireAuth, async (req, res, next) => {
  try {
    await Notification.updateMany({ user: req.user.id, readAt: null }, { $set: { readAt: new Date() } });
    res.json({ message: 'Notifications marked as read.' });
  } catch (error) { next(error); }
});

router.patch('/notifications/:notificationId/read', requireAuth, async (req, res, next) => {
  try {
    const notification = await Notification.findOneAndUpdate({ _id: req.params.notificationId, user: req.user.id }, { $set: { readAt: new Date() } }, { new: true });
    if (!notification) return res.status(404).json({ message: 'Notification not found.' });
    res.json({ notification });
  } catch (error) { next(error); }
});

router.get('/my-activity', requireAuth, async (req, res, next) => {
  try {
    const [myAuctions, bids, orders] = await Promise.all([
      Auction.find({ seller: req.user.id }).sort({ createdAt: -1 }).limit(100),
      Bid.find({ bidder: req.user.id }).sort({ createdAt: -1 }).limit(100).populate('auction', 'title status currentPrice endAt imageUrl'),
      Order.find({ $or: [{ buyer: req.user.id }, { seller: req.user.id }] }).sort({ createdAt: -1 }).populate('auction', 'title imageUrl').populate('buyer', 'name')
    ]);
    res.json({ myAuctions, bids, orders });
  } catch (error) { next(error); }
});

module.exports = router;
