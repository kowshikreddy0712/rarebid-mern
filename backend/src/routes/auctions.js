const express = require('express');
const mongoose = require('mongoose');
const crypto = require('crypto');
const Auction = require('../models/Auction');
const Bid = require('../models/Bid');
const Watchlist = require('../models/Watchlist');
const EvidenceDocument = require('../models/EvidenceDocument');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

function publicAuctionQuery() { return { reviewStatus: 'approved' }; }
function validHttpUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:'; } catch { return false; }
}

router.get('/', async (req, res, next) => {
  try {
    const query = publicAuctionQuery();
    const status = req.query.status;
    if (status === 'live') query.status = 'live';
    if (status === 'upcoming') query.status = 'scheduled';
    if (status === 'ended') query.status = 'ended';
    if (req.query.category && req.query.category !== 'All') query.category = req.query.category;
    const authenticityStatuses = ['not_assessed', 'evidence_reviewed', 'specialist_authentication_pending', 'specialist_authenticated', 'unable_to_verify'];
    if (authenticityStatuses.includes(String(req.query.authenticityStatus || ''))) query.authenticityStatus = String(req.query.authenticityStatus);
    if (req.query.q) query.$text = { $search: String(req.query.q).slice(0, 100) };
    if (req.query.minPrice || req.query.maxPrice) {
      query.currentPrice = {};
      if (Number.isFinite(Number(req.query.minPrice))) query.currentPrice.$gte = Math.max(0, Number(req.query.minPrice));
      if (Number.isFinite(Number(req.query.maxPrice))) query.currentPrice.$lte = Math.max(0, Number(req.query.maxPrice));
    }
    const sortMap = { ending: { endAt: 1 }, newest: { createdAt: -1 }, priceAsc: { currentPrice: 1 }, priceDesc: { currentPrice: -1 }, popular: { bidCount: -1 } };
    const sort = sortMap[req.query.sort] || { startAt: 1, createdAt: -1 };
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(48, Math.max(1, Number.parseInt(req.query.limit, 10) || 12));
    const [auctions, total] = await Promise.all([
      Auction.find(query).sort(sort).skip((page - 1) * limit).limit(limit).populate('seller', 'name sellerVerificationStatus'),
      Auction.countDocuments(query)
    ]);
    res.json({ auctions, page, pages: Math.ceil(total / limit), total });
  } catch (error) { next(error); }
});

router.get('/:id', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ message: 'Invalid auction ID.' });
    const auction = await Auction.findOne({ _id: req.params.id, reviewStatus: 'approved' }).populate('seller', 'name sellerVerificationStatus');
    if (!auction) return res.status(404).json({ message: 'Auction not found.' });
    const bids = await Bid.find({ auction: auction.id }).sort({ amount: -1, acceptedAt: 1 }).limit(30).populate('bidder', 'name');
    res.json({ auction, bids: bids.map(b => ({ id: b.id, amount: b.amount, acceptedAt: b.acceptedAt, bidder: b.bidder ? { name: b.bidder.name } : { name: 'Member' } })) });
  } catch (error) { next(error); }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    if (req.user.sellerVerificationStatus !== 'verified') return res.status(403).json({ message: 'Seller verification is required before creating an auction.' });
    const { title, description, category, condition, imageUrl, evidenceDescription, evidenceDocumentIds = [], startingPrice, minIncrement, durationMinutes, startAt, shippingInfo } = req.body;
    const starts = new Date(startAt);
    const duration = Number(durationMinutes);
    const start = Number(startingPrice);
    const increment = Number(minIncrement);
    const categories = ['Vehicles', 'Gold & Treasures', 'Antiques', 'Art', 'Coins', 'Collectibles', 'Books', 'Watches', 'Memorabilia', 'Militaria', 'Other'];
    const conditions = ['New', 'Excellent', 'Good', 'Fair', 'For parts / restoration'];
    if (typeof title !== 'string' || title.trim().length < 4 || title.trim().length > 120) return res.status(400).json({ message: 'Title must be between 4 and 120 characters.' });
    if (typeof description !== 'string' || description.trim().length < 20 || description.trim().length > 5000) return res.status(400).json({ message: 'Description must be between 20 and 5,000 characters.' });
    if (!categories.includes(category) || !conditions.includes(condition)) return res.status(400).json({ message: 'Choose a valid category and condition.' });
    if (!validHttpUrl(imageUrl)) return res.status(400).json({ message: 'Upload a product image or provide a valid HTTP/HTTPS image URL.' });
    if (category === 'Militaria' && /ammunition|explosive|live\s+round|cartridge/i.test(`${title} ${description}`)) return res.status(400).json({ message: 'Ammunition and explosives are prohibited.' });
    if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(increment) || increment < 1) return res.status(400).json({ message: 'Starting price and minimum increment must be positive whole-rupee amounts.' });
    if (![1, 2, 5, 10, 15, 30, 60].includes(duration)) return res.status(400).json({ message: 'Choose a supported auction duration.' });
    if (Number.isNaN(starts.getTime()) || starts.getTime() < Date.now() + 30_000) return res.status(400).json({ message: 'Choose a start time at least 30 seconds in the future.' });
    if (!Array.isArray(evidenceDocumentIds) || evidenceDocumentIds.length > 5 || evidenceDocumentIds.some(id => !mongoose.isValidObjectId(id))) return res.status(400).json({ message: 'Evidence document references are invalid.' });
    const documents = evidenceDocumentIds.length ? await EvidenceDocument.find({ _id: { $in: evidenceDocumentIds }, owner: req.user.id, auction: null, purpose: 'listing_evidence' }) : [];
    if (documents.length !== evidenceDocumentIds.length) return res.status(400).json({ message: 'One or more evidence documents are unavailable or do not belong to your account.' });
    if (category === 'Militaria' && /\b(firearm|gun|rifle|pistol|weapon|bayonet|sword)\b/i.test(`${title} ${description}`) && (!/\b(deactivated|inert|non-functional|display[- ]only|museum display)\b/i.test(`${title} ${description}`) || documents.length === 0)) return res.status(400).json({ message: 'Historical weapon listings must explicitly describe an inert/deactivated display item and include supporting documentation. Local laws still apply.' });
    const auction = await Auction.create({
      title: title.trim(), description: description.trim(), category, condition, imageUrl,
      evidenceDescription: String(evidenceDescription || '').trim(), evidenceDocuments: documents.map(doc => doc._id), seller: req.user.id,
      startingPrice: start, currentPrice: start, minIncrement: increment,
      durationMinutes: duration, startAt: starts, endAt: new Date(starts.getTime() + duration * 60_000),
      shippingInfo: String(shippingInfo || '').trim(), reviewStatus: 'pending', status: 'scheduled'
    });
    if (documents.length) await EvidenceDocument.updateMany({ _id: { $in: documents.map(doc => doc._id) }, owner: req.user.id, auction: null }, { $set: { auction: auction._id } });
    res.status(201).json({ auction, message: 'Listing submitted. It will appear publicly after administrator approval.' });
  } catch (error) { next(error); }
});

router.post('/:id/bids', requireAuth, async (req, res, next) => {
  const io = req.app.get('io');
  const session = await mongoose.startSession();
  let response;
  try {
    const bidAmount = Number(req.body.amount);
    const requestKey = String(req.body.requestKey || crypto.randomUUID()).slice(0, 100);
    if (!Number.isSafeInteger(bidAmount) || bidAmount < 1) return res.status(400).json({ message: 'Bid must be a positive whole amount in INR.' });
    await session.withTransaction(async () => {
      const previous = await Bid.findOne({ bidder: req.user.id, requestKey }).session(session);
      if (previous) {
        const existingAuction = await Auction.findById(previous.auction).session(session);
        response = { bid: previous, auction: existingAuction, duplicate: true };
        return;
      }
      const auction = await Auction.findOne({ _id: req.params.id, reviewStatus: 'approved' }).session(session);
      if (!auction) { const e = new Error('Auction not found.'); e.status = 404; throw e; }
      const now = new Date();
      if (String(auction.seller) === String(req.user.id)) { const e = new Error('You cannot bid on your own listing.'); e.status = 403; throw e; }
      if (auction.startAt > now) { const e = new Error('This auction has not started yet.'); e.status = 400; throw e; }
      if (auction.endAt <= now || auction.status === 'ended' || auction.status === 'cancelled') { const e = new Error('This auction has ended.'); e.status = 400; throw e; }
      if (!['scheduled', 'live'].includes(auction.status)) { const e = new Error('This auction is not open for bidding.'); e.status = 400; throw e; }
      const minimum = auction.bidCount === 0 ? auction.startingPrice : auction.currentPrice + auction.minIncrement;
      if (bidAmount < minimum) { const e = new Error(`Your bid must be at least ₹${minimum.toLocaleString('en-IN')}.`); e.status = 400; throw e; }
      // MongoDB transaction guarantees the auction update and bid record commit together.
      const updated = await Auction.findOneAndUpdate(
        { _id: auction.id, currentPrice: auction.currentPrice, bidCount: auction.bidCount, endAt: { $gt: now }, status: { $in: ['scheduled', 'live'] } },
        { $set: { currentPrice: bidAmount, highestBidder: req.user.id, status: 'live' }, $inc: { bidCount: 1 } },
        { new: true, session }
      );
      if (!updated) { const e = new Error('Another bid was accepted at the same time. Refresh and try again.'); e.status = 409; throw e; }
      const [bid] = await Bid.create([{ auction: auction.id, bidder: req.user.id, amount: bidAmount, acceptedAt: now, requestKey }], { session });
      response = { bid, auction: updated, duplicate: false };
    });
    if (response?.auction) {
      const hydrated = await Auction.findById(response.auction.id).populate('seller', 'name sellerVerificationStatus').populate('highestBidder', 'name');
      if (!response.duplicate) {
        const bidPayload = { id: String(response.bid._id || response.bid.id), amount: response.bid.amount, acceptedAt: response.bid.acceptedAt, bidderName: req.user.name };
        io?.to(`auction:${response.auction.id}`).emit('auction:updated', { auction: hydrated, bid: bidPayload });
        io?.emit('auction:catalog-updated', { reason: 'bid', auctionId: String(response.auction.id) });
      }
      return res.status(response.duplicate ? 200 : 201).json({ bid: response.bid, auction: hydrated, duplicate: response.duplicate });
    }
    res.status(500).json({ message: 'Bid could not be processed.' });
  } catch (error) { next(error); }
  finally { await session.endSession(); }
});

module.exports = router;
