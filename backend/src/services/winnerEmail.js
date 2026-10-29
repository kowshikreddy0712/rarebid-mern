const nodemailer = require('nodemailer');
const Order = require('../models/Order');
const Notification = require('../models/Notification');

let transport;
function emailConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_PORT && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.MAIL_FROM);
}
function getTransport() {
  if (!emailConfigured()) return null;
  if (!transport) transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
  });
  return transport;
}

async function sendWinnerContactEmail(orderId, io) {
  const mailer = getTransport();
  if (!mailer) return false;
  const now = new Date();
  // A lease prevents two scheduler instances from sending the same email concurrently.
  const claimed = await Order.findOneAndUpdate({
    _id: orderId,
    winnerContactEmailSentAt: null,
    $or: [
      { winnerContactEmailClaimedAt: null },
      { winnerContactEmailClaimedAt: { $lt: new Date(now.getTime() - 10 * 60_000) } }
    ]
  }, { $set: { winnerContactEmailClaimedAt: now, winnerContactEmailLastAttemptAt: now }, $unset: { winnerContactEmailError: 1 } }, { new: true });
  if (!claimed) return false;
  try {
    const order = await Order.findById(orderId)
      .populate('buyer', 'name email')
      .populate('seller', 'name email')
      .populate('auction', 'title currentPrice category');
    if (!order || !order.buyer?.email || !order.seller?.email || !order.auction) throw new Error('Order contact details are incomplete.');
    const subject = `You won “${order.auction.title}” on RareBid — seller contact details`;
    const text = [
      `Hello ${order.buyer.name},`, '',
      `Congratulations — you won the RareBid auction for “${order.auction.title}”.`,
      `Winning bid: ₹${Number(order.winningBidAmount).toLocaleString('en-IN')}`,
      `Category: ${order.auction.category || 'Collectible'}`, '',
      'Seller contact details for coordinating delivery:',
      `Name: ${order.seller.name}`,
      `Email: ${order.seller.email}`, '',
      'Please discuss shipping, packaging, and delivery directly with the seller. Do not send additional payments outside any agreed and verified platform process. This starter does not collect payments or provide escrow.', '',
      'RareBid'
    ].join('\n');
    const html = `<p>Hello ${escapeHtml(order.buyer.name)},</p><p>Congratulations — you won the RareBid auction for <strong>${escapeHtml(order.auction.title)}</strong>.</p><p><strong>Winning bid:</strong> ₹${Number(order.winningBidAmount).toLocaleString('en-IN')}<br><strong>Category:</strong> ${escapeHtml(order.auction.category || 'Collectible')}</p><h3>Seller contact details</h3><p><strong>Name:</strong> ${escapeHtml(order.seller.name)}<br><strong>Email:</strong> <a href="mailto:${escapeHtml(order.seller.email)}">${escapeHtml(order.seller.email)}</a></p><p>Please discuss shipping, packaging, and delivery directly with the seller. Do not send additional payments outside any agreed and verified platform process. This starter does not collect payments or provide escrow.</p><p>RareBid</p>`;
    await mailer.sendMail({ from: process.env.MAIL_FROM, to: order.buyer.email, subject, text, html });
    await Order.updateOne({ _id: order._id, winnerContactEmailSentAt: null }, { $set: { winnerContactEmailSentAt: new Date() }, $unset: { winnerContactEmailClaimedAt: 1, winnerContactEmailError: 1 } });
    await Notification.create({ user: order.buyer._id, type: 'auction_won', auction: order.auction._id, message: `You won “${order.auction.title}”. Seller contact details were sent to ${order.buyer.email}.` });
    io?.to(`user:${String(order.buyer._id)}`).emit('notification:new', { type: 'auction_won', auctionId: String(order.auction._id), message: `You won “${order.auction.title}”. Seller contact details were emailed to you.` });
    return true;
  } catch (error) {
    await Order.updateOne({ _id: orderId }, { $set: { winnerContactEmailError: String(error.message || 'Email delivery failed').slice(0, 500) }, $unset: { winnerContactEmailClaimedAt: 1 } });
    console.error('[winner-email] delivery failed:', error.message);
    return false;
  }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}
module.exports = { sendWinnerContactEmail, emailConfigured };
