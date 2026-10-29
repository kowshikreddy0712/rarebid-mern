require('dotenv').config();
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const User = require('./models/User');
const Auction = require('./models/Auction');
const Bid = require('./models/Bid');
const Watchlist = require('./models/Watchlist');
const Order = require('./models/Order');

async function seed() {
  if (!process.env.ADMIN_EMAIL || !process.env.ADMIN_PASSWORD || !process.env.ADMIN_NAME) {
    throw new Error('Set ADMIN_NAME, ADMIN_EMAIL and ADMIN_PASSWORD in backend/.env before running the seed script.');
  }
  if (process.env.ADMIN_PASSWORD.length < 12) throw new Error('ADMIN_PASSWORD must be at least 12 characters.');
  await connectDB();
  const email = process.env.ADMIN_EMAIL.toLowerCase();
  let admin = await User.findOne({ email }).select('+passwordHash');
  if (!admin) {
    admin = await User.create({ name: process.env.ADMIN_NAME, email, passwordHash: await bcrypt.hash(process.env.ADMIN_PASSWORD, 12), role: 'admin', sellerVerificationStatus: 'verified' });
    console.log(`Created admin account: ${email}`);
  } else {
    console.log(`Admin account already exists: ${email}`);
  }
  const demos = [
    { title: 'Vintage brass nautical compass', description: 'A vintage brass nautical compass with a warm patina and classic hinged lid. Please review the photographs carefully; age and provenance have not been independently authenticated.', category: 'Collectibles', condition: 'Good', imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=85', startingPrice: 1800, currentPrice: 1800, minIncrement: 100, durationMinutes: 30, shippingInfo: 'Seller-arranged tracked shipping; final costs confirmed before dispatch.' },
    { title: 'Antique-style carved wooden elephant', description: 'Decorative carved wooden elephant offered as a collectible object. The exact age, wood species and origin are not independently verified; inspect condition details before bidding.', category: 'Antiques', condition: 'Good', imageUrl: 'https://images.unsplash.com/photo-1544735716-392fe2489ffa?auto=format&fit=crop&w=1200&q=85', startingPrice: 950, currentPrice: 950, minIncrement: 50, durationMinutes: 30, shippingInfo: 'Protective packaging and tracked shipping.' },
    { title: 'First-edition classic literature collection', description: 'A small collection of vintage hardback literature. Edition details and publication dates should be assessed from the item photographs; no third-party appraisal is included.', category: 'Books', condition: 'Fair', imageUrl: 'https://images.unsplash.com/photo-1519682337058-a94d519337bc?auto=format&fit=crop&w=1200&q=85', startingPrice: 2200, currentPrice: 2200, minIncrement: 100, durationMinutes: 30, shippingInfo: 'Books packed with corner protection and tracked shipping.' },
    { title: 'Mechanical wristwatch — restoration project', description: 'A vintage mechanical wristwatch offered as a restoration project. Working condition, service history and authenticity are not guaranteed; sold as described in the photographs.', category: 'Watches', condition: 'For parts / restoration', imageUrl: 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=1200&q=85', startingPrice: 3500, currentPrice: 3500, minIncrement: 250, durationMinutes: 30, shippingInfo: 'Insured, tracked shipping recommended.' },
    { title: 'Classic 1960s European collector car — example listing', description: 'Demonstration listing for a classic collector vehicle. Registration, chassis/VIN, ownership history, mechanical condition, and import status must be independently checked before purchase. This demo listing does not represent a real vehicle for sale.', category: 'Vehicles', condition: 'Good', imageUrl: 'https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=85', startingPrice: 450000, currentPrice: 450000, minIncrement: 10000, durationMinutes: 30, shippingInfo: 'Vehicle transport and paperwork would be arranged separately after checks.' },
    { title: 'Gold sovereign coins — sample collectible lot', description: 'Demonstration listing for collectible gold coins. Metal content, weight, date, mint marks, and provenance require independent verification. This is sample data, not an offer of real bullion.', category: 'Gold & Treasures', condition: 'Good', imageUrl: 'https://images.unsplash.com/photo-1610375461246-83df859d849d?auto=format&fit=crop&w=1200&q=85', startingPrice: 25000, currentPrice: 25000, minIncrement: 1000, durationMinutes: 30, shippingInfo: 'Insured shipping only after identity, insurance, and legal requirements are confirmed.' },
    { title: 'Original abstract canvas — appraisal required', description: 'Demonstration artwork listing. Artist attribution, provenance, materials, and valuation have not been independently verified. Request a condition report and specialist appraisal before bidding.', category: 'Art', condition: 'Good', imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b6a5?auto=format&fit=crop&w=1200&q=85', startingPrice: 12000, currentPrice: 12000, minIncrement: 500, durationMinutes: 30, shippingInfo: 'Protective art packaging and insured courier recommended.' },
    { title: 'Celebrity-signed tour T-shirt — authentication pending', description: 'Demonstration memorabilia listing. The signature is not authenticated; a reputable third-party certificate and provenance should be reviewed before any real sale. This sample is not an assertion of celebrity endorsement.', category: 'Memorabilia', condition: 'Good', imageUrl: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=1200&q=85', startingPrice: 5000, currentPrice: 5000, minIncrement: 250, durationMinutes: 30, shippingInfo: 'Ship in protective archival packaging.' },
    { title: 'World War II-era field binoculars — historical militaria', description: 'Demonstration historical militaria listing. Serial markings, date, originality, export/import restrictions, and provenance require specialist review. RareBid prohibits ammunition, explosives, and unlawful or functional weapon listings; all militaria remains subject to local law and administrator review.', category: 'Militaria', condition: 'Fair', imageUrl: 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?auto=format&fit=crop&w=1200&q=85', startingPrice: 6500, currentPrice: 6500, minIncrement: 250, durationMinutes: 30, shippingInfo: 'Shipping only where permitted; buyer and seller must comply with applicable laws.' }
  ];
  const existing = await Auction.countDocuments({ seller: admin._id });
  if (!existing) {
    const now = Date.now();
    await Auction.insertMany(demos.map((item, i) => ({ ...item, seller: admin._id, reviewStatus: 'approved', status: i === 2 ? 'scheduled' : 'live', startAt: new Date(now + (i === 2 ? 15 * 60_000 : -10 * 60_000)), endAt: new Date(now + (i === 2 ? 45 * 60_000 : (25 - Math.min(i, 6) * 2) * 60_000)), bidCount: 0, highestBidder: null, evidenceDescription: 'Seed/demo listing. Authenticity has not been independently verified.' })));
    console.log('Created demo auction listings. They are clearly labeled as demo examples in the README.');
  }
  await mongoose.disconnect();
}
seed().catch(async error => { console.error(error.message); await mongoose.disconnect().catch(() => {}); process.exit(1); });
