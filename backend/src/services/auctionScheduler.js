const mongoose = require('mongoose');
const Auction = require('../models/Auction');
const Order = require('../models/Order');
const Reminder = require('../models/Reminder');
const Notification = require('../models/Notification');
const { sendWinnerContactEmail, emailConfigured } = require('./winnerEmail');

let timer;
let running = false;

async function transitionAuctions(io) {
  if (running) return;
  running = true;
  try {
    const now = new Date();
    const started = await Auction.updateMany(
      { reviewStatus: 'approved', status: 'scheduled', startAt: { $lte: now }, endAt: { $gt: now } },
      { $set: { status: 'live' } }
    );
    if (started.modifiedCount) io.emit('auction:catalog-updated', { reason: 'started' });

    await processReminders(now, io);
    if (emailConfigured()) {
      const pendingContactEmails = await Order.find({ winnerContactEmailSentAt: null, $or: [{ winnerContactEmailLastAttemptAt: null }, { winnerContactEmailLastAttemptAt: { $lt: new Date(now.getTime() - 60_000) } }] }).select('_id').limit(20);
      for (const order of pendingContactEmails) await sendWinnerContactEmail(order._id, io);
    }

    const expired = await Auction.find({ reviewStatus: 'approved', status: { $in: ['scheduled', 'live'] }, endAt: { $lte: now } }).select('_id').limit(100);
    for (const candidate of expired) await closeAuction(candidate._id, io);
  } catch (error) {
    console.error('[auction-scheduler] cycle failed:', error.message);
  } finally {
    running = false;
  }
}

async function closeAuction(auctionId, io) {
  const session = await mongoose.startSession();
  let closed;
  try {
    await session.withTransaction(async () => {
      const auction = await Auction.findOne({ _id: auctionId, reviewStatus: 'approved', status: { $in: ['scheduled', 'live'] }, endAt: { $lte: new Date() } }).session(session);
      if (!auction) return;
      auction.status = 'ended';
      auction.closedAt = new Date();
      auction.winner = auction.highestBidder || null;
      await auction.save({ session });
      if (auction.highestBidder) {
        await Order.updateOne(
          { auction: auction.id },
          { $setOnInsert: {
            auction: auction.id, buyer: auction.highestBidder, seller: auction.seller,
            winningBidAmount: auction.currentPrice, currency: 'INR', paymentStatus: 'awaiting_payment',
            fulfillmentStatus: 'awaiting_fulfillment', paymentDueAt: new Date(Date.now() + 24 * 60 * 60 * 1000)
          } },
          { upsert: true, session }
        );
      }
      closed = auction.toObject();
    });
  } catch (error) {
    console.error(`[auction-scheduler] could not close ${auctionId}:`, error.message);
  } finally {
    await session.endSession();
  }
  if (closed) {
    io.to(`auction:${String(auctionId)}`).emit('auction:ended', { auction: closed });
    io.emit('auction:catalog-updated', { reason: 'ended', auctionId: String(auctionId) });
  }
}


async function processReminders(now, io) {
  const due = await Reminder.find({ sentAt: null, scheduledAt: { $lte: now } }).limit(100).populate('auction', 'title startAt status endAt');
  for (const reminder of due) {
    const claimed = await Reminder.findOneAndUpdate({ _id: reminder._id, sentAt: null }, { $set: { sentAt: now } }, { new: true });
    if (!claimed || !reminder.auction) continue;
    const auction = reminder.auction;
    await Notification.create({
      user: reminder.user,
      type: 'auction_start',
      auction: auction._id,
      message: `Reminder: “${auction.title}” is scheduled to start soon.`
    });
    io.to(`user:${String(reminder.user)}`).emit('notification:new', { type: 'auction_start', auctionId: String(auction._id), message: `Reminder: “${auction.title}” is scheduled to start soon.` });
  }
}

function startAuctionScheduler(io) {
  if (timer) clearInterval(timer);
  transitionAuctions(io);
  timer = setInterval(() => transitionAuctions(io), 2000);
  timer.unref?.();
}

function stopAuctionScheduler() { if (timer) clearInterval(timer); timer = null; }
module.exports = { startAuctionScheduler, stopAuctionScheduler, transitionAuctions };
