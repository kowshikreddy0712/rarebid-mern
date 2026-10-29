import { Link } from 'react-router-dom';
import { Bookmark, Clock3, Gavel, ShieldCheck } from 'lucide-react';
import { formatCountdown, formatINR } from '../api';
import { useEffect, useState } from 'react';

export default function AuctionCard({ auction, saved = false, onToggleSave }) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, []);
  const scheduled = auction.status === 'scheduled' || new Date(auction.startAt).getTime() > now;
  const ended = auction.status === 'ended' || new Date(auction.endAt).getTime() <= now;
  return <article className="auction-card">
    <Link to={`/auctions/${auction._id}`} className="card-image-wrap">
      <img className="card-image" src={auction.imageUrl} alt={auction.title} loading="lazy" onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1000&q=80'; }} />
      <span className={`status-pill ${ended ? 'status-ended' : scheduled ? 'status-upcoming' : 'status-live'}`}><span className="status-dot" />{ended ? 'Closed' : scheduled ? 'Upcoming' : 'Live auction'}</span>
    </Link>
    {onToggleSave && <button className={`save-floating ${saved ? 'saved' : ''}`} onClick={() => onToggleSave(auction)} aria-label={saved ? 'Remove from watchlist' : 'Add to watchlist'}><Bookmark size={17} fill={saved ? 'currentColor' : 'none'} /></button>}
    <div className="card-content">
      <div className="card-kicker"><span>{auction.category}</span><span>{auction.condition}</span></div>
      <Link to={`/auctions/${auction._id}`} className="card-title">{auction.title}</Link>
      <div className="card-seller"><span className="seller-avatar">{auction.seller?.name?.slice(0, 1) || 'R'}</span>{auction.seller?.name || 'RareBid member'}{auction.seller?.sellerVerificationStatus === 'verified' && <ShieldCheck size={14} className="verified-icon" />}</div>
      <div className="card-bottom"><div><span className="muted-label">{auction.bidCount > 0 ? 'Current bid' : 'Starting at'}</span><strong className="price">{formatINR(auction.currentPrice)}</strong></div><div className="ending-meta"><Clock3 size={14} /><span>{ended ? 'Auction ended' : scheduled ? `Starts ${new Date(auction.startAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : formatCountdown(auction.endAt, now)}</span></div></div>
      <div className="card-footer"><span><Gavel size={14} /> {auction.bidCount || 0} {(auction.bidCount || 0) === 1 ? 'bid' : 'bids'}</span><Link to={`/auctions/${auction._id}`} className="text-link">View lot <span>↗</span></Link></div>
    </div>
  </article>;
}
