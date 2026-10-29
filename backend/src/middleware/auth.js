const jwt = require('jsonwebtoken');
const User = require('../models/User');

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies?.rarebid_token || (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ message: 'Please log in to continue.' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub);
    if (!user || user.status !== 'active') return res.status(401).json({ message: 'Account not available.' });
    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ message: 'Session expired. Please log in again.' });
  }
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') return res.status(403).json({ message: 'Administrator access required.' });
  next();
}

module.exports = { requireAuth, requireAdmin };
