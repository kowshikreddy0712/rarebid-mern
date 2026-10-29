const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const Order = require('../models/Order');
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');
const router = express.Router();

function configured() { return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET); }
function getGateway() {
  if (!configured()) return null;
  return new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
}
async function markOrderPaid(order, paymentId, io) {
  const updated = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $ne: 'paid' } },
    { $set: { paymentStatus: 'paid', paymentId, paidAt: new Date(), fulfillmentStatus: 'awaiting_fulfillment' } },
    { new: true }
  );
  if (updated) {
    await Notification.create({ user: updated.seller, type: 'order_paid', auction: updated.auction, message: `Payment was confirmed for an auction you sold. You can coordinate fulfillment with the buyer.` });
    io?.to(`user:${String(updated.seller)}`).emit('notification:new', { type: 'order_paid', auctionId: String(updated.auction), message: 'Payment confirmed for an item you sold.' });
  }
  return updated || order;
}

router.post('/:orderId/create-order', requireAuth, async (req, res, next) => {
  try {
    if (!configured()) return res.status(503).json({ message: 'Online payments are not configured. Add Razorpay test keys to backend/.env.' });
    const order = await Order.findOne({ _id: req.params.orderId, buyer: req.user.id });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    if (order.paymentStatus === 'paid') return res.status(409).json({ message: 'This order has already been paid.' });
    if (order.paymentStatus !== 'awaiting_payment') return res.status(400).json({ message: 'This order is not awaiting payment.' });
    let gatewayOrderId = order.paymentGatewayOrderId;
    if (!gatewayOrderId) {
      const gateway = getGateway();
      const created = await gateway.orders.create({ amount: Math.round(order.winningBidAmount * 100), currency: 'INR', receipt: `rb-${String(order._id).slice(-20)}`, notes: { rarebidOrderId: String(order._id) } });
      const claimed = await Order.findOneAndUpdate({ _id: order._id, paymentStatus: 'awaiting_payment', paymentGatewayOrderId: null }, { $set: { paymentGatewayOrderId: created.id } }, { new: true });
      gatewayOrderId = claimed?.paymentGatewayOrderId || (await Order.findById(order._id)).paymentGatewayOrderId;
    }
    res.json({ keyId: process.env.RAZORPAY_KEY_ID, gatewayOrderId, amount: Math.round(order.winningBidAmount * 100), currency: 'INR', orderId: String(order._id), buyerName: req.user.name, buyerEmail: req.user.email });
  } catch (error) { next(error); }
});

router.post('/:orderId/verify', requireAuth, async (req, res, next) => {
  try {
    if (!configured()) return res.status(503).json({ message: 'Online payments are not configured.' });
    const order = await Order.findOne({ _id: req.params.orderId, buyer: req.user.id });
    if (!order) return res.status(404).json({ message: 'Order not found.' });
    const { razorpay_order_id: gatewayOrderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body || {};
    if (!gatewayOrderId || !paymentId || !signature || gatewayOrderId !== order.paymentGatewayOrderId) return res.status(400).json({ message: 'Payment details do not match this order.' });
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${gatewayOrderId}|${paymentId}`).digest('hex');
    const a = Buffer.from(expected); const b = Buffer.from(String(signature));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ message: 'Payment signature verification failed.' });
    const payment = await getGateway().payments.fetch(paymentId);
    if (payment.order_id !== gatewayOrderId || payment.amount !== Math.round(order.winningBidAmount * 100) || payment.currency !== 'INR' || payment.status !== 'captured') return res.status(400).json({ message: 'The gateway has not confirmed a captured payment for the expected amount.' });
    const updated = await markOrderPaid(order, paymentId, req.app.get('io'));
    res.json({ message: 'Payment verified.', order: updated });
  } catch (error) { next(error); }
});

// Configure RAZORPAY_WEBHOOK_SECRET in production. The server captures raw JSON bytes for signature verification.
router.post('/webhook', async (req, res) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return res.status(503).json({ message: 'Payment webhook is not configured.' });
  const signature = req.get('x-razorpay-signature') || '';
  const rawBody = req.rawBody;
  if (!rawBody) return res.status(400).json({ message: 'Raw webhook body is unavailable.' });
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected); const b = Buffer.from(signature);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return res.status(400).json({ message: 'Invalid webhook signature.' });
  try {
    const event = req.body;
    if (['payment.captured', 'order.paid'].includes(event.event)) {
      const entity = event.payload?.payment?.entity;
      const orderEntity = event.payload?.order?.entity;
      const gatewayOrderId = entity?.order_id || orderEntity?.id;
      const paymentId = entity?.id || null;
      const amountInPaise = entity?.amount ?? orderEntity?.amount_paid;
      if (gatewayOrderId) {
        const order = await Order.findOne({ paymentGatewayOrderId: gatewayOrderId });
        if (order && amountInPaise === Math.round(order.winningBidAmount * 100)) await markOrderPaid(order, paymentId, req.app.get('io'));
      }
    }
    res.json({ received: true });
  } catch (error) { console.error('[payment-webhook]', error.message); res.status(500).json({ message: 'Webhook processing failed.' }); }
});
module.exports = router;
