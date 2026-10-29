import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ArrowLeft, ArrowRight, Bookmark, CheckCircle2, Clock3, Gavel, Info, PackageCheck, ShieldCheck, Share2, Truck } from 'lucide-react';
import { api, formatCountdown, formatDate, formatINR, getErrorMessage, SOCKET_URL } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AuctionPage() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [auction, setAuction] = useState(null);
  const [bids, setBids] = useState([]);
  const [saved, setSaved] = useState(false);
  const [reminderSet, setReminderSet] = useState(false);
  const [amount, setAmount] = useState('');
  const [now, setNow] = useState(Date.now());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const { data } = await api.get(`/auctions/${id}`);
      setAuction(data.auction); setBids(data.bids || []);
      setAmount(String(data.auction.bidCount > 0 ? data.auction.currentPrice + data.auction.minIncrement : data.auction.startingPrice));
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); const timer = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(timer); }, [load]);
  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('auction:join', id));
    socket.on('auction:updated', ({ auction: latest, bid }) => {
      if (latest?._id === id) setAuction(latest);
      if (bid) setBids(previous => { if (bid.id && previous.some(item => String(item.id || item._id) === String(bid.id))) return previous; return [{ id: bid.id || `${bid.acceptedAt}-${bid.amount}`, amount: bid.amount, acceptedAt: bid.acceptedAt, bidder: { name: bid.bidderName || 'Member' } }, ...previous].slice(0, 30); });
      setNotice({ type: 'success', text: 'A new bid has been accepted.' });
    });
    socket.on('auction:ended', ({ auction: ended }) => { if (ended?._id === id) setAuction(ended); setNotice({ type: 'info', text: 'This auction has closed.' }); });
    return () => { socket.emit('auction:leave', id); socket.disconnect(); };
  }, [id]);
  useEffect(() => {
    if (!user || !auction) { setSaved(false); return; }
    api.get('/users/watchlist').then(({ data }) => setSaved(data.auctions.some(item => item._id === auction._id))).catch(() => {});
  }, [user, auction?._id]);
  useEffect(() => {
    if (!user || !auction) { setReminderSet(false); return; }
    api.get('/users/reminders').then(({ data }) => setReminderSet(data.reminders.some(item => item.auction?._id === auction._id))).catch(() => {});
  }, [user, auction?._id]);

  const auctionState = useMemo(() => {
    if (!auction) return 'loading';
    if (auction.status === 'ended' || auction.status === 'cancelled' || new Date(auction.endAt).getTime() <= now) return 'ended';
    if (new Date(auction.startAt).getTime() > now || auction.status === 'scheduled') return 'upcoming';
    return 'live';
  }, [auction, now]);
  const minimumBid = auction ? (auction.bidCount > 0 ? auction.currentPrice + auction.minIncrement : auction.startingPrice) : 0;

  async function placeBid(e) {
    e.preventDefault(); setError(''); setNotice(null);
    if (!user) return navigate('/login');
    if (!auction || auctionState !== 'live') return setError('Bidding is not open for this auction.');
    if (String(auction.seller?._id || auction.seller) === user._id) return setError('You cannot bid on your own listing.');
    const bidAmount = Number(amount);
    if (!Number.isSafeInteger(bidAmount) || bidAmount < minimumBid) return setError(`Enter a whole-rupee bid of at least ${formatINR(minimumBid)}.`);
    setBusy(true);
    try {
      const { data } = await api.post(`/auctions/${id}/bids`, { amount: bidAmount, requestKey: crypto.randomUUID() });
      setAuction(data.auction); setBids(previous => { if (previous.some(item => String(item.id || item._id) === String(data.bid._id))) return previous; return [{ id: data.bid._id, amount: data.bid.amount, acceptedAt: data.bid.acceptedAt, bidder: { name: user.name } }, ...previous].slice(0, 30); });
      setAmount(String(data.auction.currentPrice + data.auction.minIncrement));
      setNotice({ type: 'success', text: data.duplicate ? 'This bid was already processed.' : 'Your bid is in. Good luck.' });
    } catch (err) { setError(getErrorMessage(err)); await load(); }
    finally { setBusy(false); }
  }

  async function toggleSaved() {
    if (!user) return navigate('/login');
    try {
      if (saved) await api.delete(`/users/watchlist/${id}`); else await api.post(`/users/watchlist/${id}`);
      setSaved(!saved); setNotice({ type: 'success', text: saved ? 'Removed from your watchlist.' : 'Saved to your watchlist.' });
    } catch (err) { setError(getErrorMessage(err)); }
  }

  async function toggleReminder() {
    if (!user) return navigate('/login');
    setError('');
    try {
      if (reminderSet) { await api.delete(`/users/reminders/${id}`); setReminderSet(false); setNotice({ type: 'success', text: 'Auction reminder removed.' }); }
      else { await api.post(`/users/reminders/${id}`, { minutesBefore: 5 }); setReminderSet(true); setNotice({ type: 'success', text: 'Reminder set. You will see an in-app notification before the auction starts.' }); }
    } catch (err) { setError(getErrorMessage(err)); }
  }

  if (loading) return <main className="wrap page-content"><div className="page-loading">Loading auction details…</div></main>;
  if (error && !auction) return <main className="wrap page-content"><Link className="back-link" to="/"><ArrowLeft size={16} /> Back to marketplace</Link><div className="empty-state"><h3>We couldn't open this lot</h3><p>{error}</p><button className="button-primary" onClick={load}>Try again</button></div></main>;
  if (!auction) return null;
  return <main className="wrap detail-page">
    <div className="detail-breadcrumb"><Link to="/"><ArrowLeft size={15} /> Marketplace</Link><span>/</span><span>{auction.category}</span><span>/</span><span className="breadcrumb-current">{auction.title}</span></div>
    {notice && <div className={`notice-banner ${notice.type}`}><CheckCircle2 size={16} />{notice.text}<button onClick={() => setNotice(null)} aria-label="Dismiss">×</button></div>}
    {error && <div className="inline-error detail-error">{error}<button onClick={() => setError('')}>Dismiss</button></div>}
    <div className="detail-layout">
      <section className="detail-gallery"><div className="detail-main-image"><img src={auction.imageUrl} alt={auction.title} onError={e => { e.currentTarget.src = 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1200&q=80'; }} /><span className={`status-pill ${auctionState === 'live' ? 'status-live' : auctionState === 'upcoming' ? 'status-upcoming' : 'status-ended'}`}><span className="status-dot" />{auctionState === 'live' ? 'Live auction' : auctionState === 'upcoming' ? 'Upcoming' : 'Auction closed'}</span></div><div className="image-caption"><span>LOT #{auction._id.slice(-6).toUpperCase()}</span><button onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setNotice({ type: 'success', text: 'Auction link copied.' }); } catch { setNotice({ type: 'info', text: window.location.href }); } }}><Share2 size={15} /> Share lot</button></div><div className="evidence-box"><span className="evidence-icon"><ShieldCheck size={18} /></span><div><strong>Product review status: {(auction.authenticityStatus || 'not_assessed').replaceAll('_', ' ')}</strong><p>{auction.authenticityReviewNote || auction.evidenceDescription || 'The seller has not provided an additional evidence summary.'} Listing approval is not an authenticity guarantee. Review evidence carefully and obtain independent expert advice for high-value items.</p>{auction.authenticityReviewedAt && <small>Last reviewed {formatDate(auction.authenticityReviewedAt)}</small>}</div></div><div className="detail-description"><div className="detail-section-heading"><h3>About this piece</h3><span>{auction.condition}</span></div><p>{auction.description}</p><div className="detail-meta-grid"><div><span>Category</span><strong>{auction.category}</strong></div><div><span>Condition</span><strong>{auction.condition}</strong></div><div><span>Listed</span><strong>{formatDate(auction.createdAt)}</strong></div><div><span>Seller</span><strong>{auction.seller?.name || 'RareBid member'} {auction.seller?.sellerVerificationStatus === 'verified' ? '✓' : ''}</strong></div></div></div><div className="shipping-box"><Truck size={19} /><div><strong>Shipping & delivery</strong><p>{auction.shippingInfo || 'Shipping details will be confirmed by the seller before dispatch.'}</p></div></div></section>
      <aside className="detail-sidebar"><div className="detail-panel"><div className="panel-topline"><span>{auction.category.toUpperCase()} / LOT</span><span>#{auction._id.slice(-6).toUpperCase()}</span></div><h1>{auction.title}</h1><div className="seller-line"><span className="seller-avatar large">{auction.seller?.name?.slice(0, 1) || 'R'}</span><span><small>Listed by</small><strong>{auction.seller?.name || 'RareBid member'}</strong></span>{auction.seller?.sellerVerificationStatus === 'verified' && <span className="verified-tag"><ShieldCheck size={13} /> Verified seller</span>}</div><div className="price-panel"><span className="muted-label">{auction.bidCount > 0 ? 'Current highest bid' : 'Starting price'}</span><div className="detail-price">{formatINR(auction.currentPrice)}</div><div className="price-subline"><span><Gavel size={14} /> {auction.bidCount} {auction.bidCount === 1 ? 'bid' : 'bids'}</span><span>Increment {formatINR(auction.minIncrement)}</span></div></div><div className="countdown-panel"><div className="countdown-icon"><Clock3 size={18} /></div><div><span>{auctionState === 'live' ? 'Bidding closes in' : auctionState === 'upcoming' ? 'Bidding starts in' : 'Auction closed'}</span><strong className={auctionState === 'live' ? 'countdown-live' : ''}>{auctionState === 'live' || auctionState === 'upcoming' ? formatCountdown(auctionState === 'live' ? auction.endAt : auction.startAt, now) : 'This lot has ended'}</strong><small>{auctionState === 'live' ? `Ends ${formatDate(auction.endAt)}` : auctionState === 'upcoming' ? `Starts ${formatDate(auction.startAt)}` : `Closed ${auction.closedAt ? formatDate(auction.closedAt) : formatDate(auction.endAt)}`}</small></div></div>
      {auctionState === 'live' ? <form className="bid-form" onSubmit={placeBid}><label className="field-label">Your maximum bid (₹)<div className="bid-input-wrap"><span>₹</span><input type="number" min={minimumBid} step="1" required value={amount} onChange={e => setAmount(e.target.value)} /></div></label><div className="bid-hint"><Info size={14} /> Minimum valid bid: <strong>{formatINR(minimumBid)}</strong></div><button className="button-primary bid-submit" disabled={busy}>{busy ? 'Submitting bid…' : 'Place a bid'} <ArrowRight size={17} /></button><p className="bid-terms">By bidding, you agree to purchase this item if you win and to pay within the stated deadline.</p></form> : auctionState === 'upcoming' ? <div className="auction-state-message"><Clock3 size={19} /><strong>Not open for bidding yet</strong><p>You can save this lot and return when the auction begins.</p></div> : <div className="auction-state-message"><CheckCircle2 size={19} /><strong>Auction closed</strong><p>{auction.winner ? `Winner selected. Winning bid: ${formatINR(auction.currentPrice)}.` : 'No winner was recorded for this lot.'}</p></div>}
      {auctionState === 'upcoming' && <button className={`watchlist-button ${reminderSet ? 'is-saved' : ''}`} onClick={toggleReminder}><Clock3 size={16} /> {reminderSet ? 'Reminder set · Remove reminder' : 'Remind me before it starts'}</button>}
      <button className={`watchlist-button ${saved ? 'is-saved' : ''}`} onClick={toggleSaved}><Bookmark size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved to watchlist' : 'Save to watchlist'}</button><div className="buyer-protection"><ShieldCheck size={17} /><span><strong>Bid thoughtfully</strong><small>Check item details, evidence, and delivery terms before bidding.</small></span></div></div>
      <div className="bid-history-panel"><div className="detail-section-heading"><h3>Bid history</h3><span>{bids.length} recent</span></div>{bids.length ? <div className="bid-history-list">{bids.map((bid, index) => <div className="bid-history-row" key={bid.id || `${bid.acceptedAt}-${index}`}><span className="bid-rank">{index === 0 ? <Gavel size={15} /> : index + 1}</span><span className="bidder-name">{bid.bidder?.name || 'Member'}<small>{bid.acceptedAt ? formatDate(bid.acceptedAt) : ''}</small></span><strong>{formatINR(bid.amount)}</strong></div>)}</div> : <div className="no-bids"><Gavel size={18} /><span>No bids yet. Be the first.</span></div>}</div>
      </aside>
    </div>
  </main>;
}
