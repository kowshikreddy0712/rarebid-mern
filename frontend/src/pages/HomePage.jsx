import { useEffect, useMemo, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { io } from 'socket.io-client';
import { ArrowDownWideNarrow, ArrowRight, ArrowUpRight, Clock3, Compass, Search, Sparkles, ShieldCheck, SlidersHorizontal, X } from 'lucide-react';
import { api, getErrorMessage, SOCKET_URL } from '../api';
import { useAuth } from '../context/AuthContext';
import AuctionCard from '../components/AuctionCard';

const categories = ['All', 'Vehicles', 'Gold & Treasures', 'Antiques', 'Art', 'Coins', 'Collectibles', 'Books', 'Watches', 'Memorabilia', 'Militaria'];

export default function HomePage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [auctions, setAuctions] = useState([]);
  const [savedIds, setSavedIds] = useState(new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState(searchParams.get('q') || '');
  const [category, setCategory] = useState(searchParams.get('category') || 'All');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [sort, setSort] = useState(searchParams.get('sort') || 'ending');
  const [authenticityStatus, setAuthenticityStatus] = useState(searchParams.get('authenticityStatus') || '');
  const { user } = useAuth();

  async function loadAuctions() {
    setLoading(true); setError('');
    try {
      const params = { sort, limit: 24 };
      if (query.trim()) params.q = query.trim();
      if (category !== 'All') params.category = category;
      if (status) params.status = status;
      if (authenticityStatus) params.authenticityStatus = authenticityStatus;
      const { data } = await api.get('/auctions', { params });
      setAuctions(data.auctions || []);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { setQuery(searchParams.get('q') || ''); setCategory(searchParams.get('category') || 'All'); setStatus(searchParams.get('status') || ''); setSort(searchParams.get('sort') || 'ending'); setAuthenticityStatus(searchParams.get('authenticityStatus') || ''); }, [searchParams]);
  useEffect(() => { loadAuctions(); // state changes define the catalogue query
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, status, sort, authenticityStatus]);
  useEffect(() => {
    const socket = io(SOCKET_URL, { withCredentials: true, transports: ['websocket', 'polling'] });
    socket.on('auction:catalog-updated', () => loadAuctions());
    return () => socket.disconnect();
    // Reconnect only when catalogue filters change so the callback reads the current filters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category, status, sort, authenticityStatus]);
  useEffect(() => {
    if (!user) { setSavedIds(new Set()); return; }
    api.get('/users/watchlist').then(({ data }) => setSavedIds(new Set(data.auctions.map(a => a._id)))).catch(() => {});
  }, [user]);

  const liveAuctions = useMemo(() => auctions.filter(a => a.status === 'live' && new Date(a.endAt).getTime() > Date.now()), [auctions]);
  async function toggleSave(auction) {
    if (!user) { window.location.href = '/login'; return; }
    const wasSaved = savedIds.has(auction._id);
    setSavedIds(previous => { const next = new Set(previous); wasSaved ? next.delete(auction._id) : next.add(auction._id); return next; });
    try {
      if (wasSaved) await api.delete(`/users/watchlist/${auction._id}`);
      else await api.post(`/users/watchlist/${auction._id}`);
    } catch (err) {
      setSavedIds(previous => { const next = new Set(previous); wasSaved ? next.add(auction._id) : next.delete(auction._id); return next; });
      setError(getErrorMessage(err));
    }
  }
  function applySearch(event) { event.preventDefault(); setSearchParams({ ...(query.trim() ? { q: query.trim() } : {}), ...(category !== 'All' ? { category } : {}), ...(status ? { status } : {}), ...(sort !== 'ending' ? { sort } : {}), ...(authenticityStatus ? { authenticityStatus } : {}) }); }

  return <main>
    <section className="hero wrap">
      <div className="hero-copy">
        <div className="eyebrow"><span className="eyebrow-line" /> A different kind of marketplace</div>
        <h1>Find the things<br />that <em>find you.</em></h1>
        <p className="hero-description">Rare objects, remarkable stories. Discover considered collectibles, antiques, and one-of-a-kind pieces — one bid at a time.</p>
        <div className="hero-actions"><a href="#marketplace" className="button-primary">Explore the collection <ArrowRight size={17} /></a><Link to="/sell" className="button-quiet">How selling works <ArrowUpRight size={16} /></Link></div>
        <div className="hero-proof"><div className="proof-avatars"><span>R</span><span>A</span><span>M</span><span>+</span></div><div><strong>For curious collectors</strong><span>Thoughtful finds. Transparent bidding.</span></div></div>
      </div>
      <div className="hero-art">
        <div className="hero-image-main"><img src="https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=1300&q=90" alt="An artful collection of vintage and collectible objects" /></div>
        <div className="hero-image-small"><img src="https://images.unsplash.com/photo-1524592094714-0f0654e20314?auto=format&fit=crop&w=600&q=85" alt="Vintage wristwatch" /></div>
        <div className="hero-note"><span className="note-icon"><Sparkles size={16} /></span><span><strong>Every object has a past.</strong><small>Find its next chapter.</small></span></div>
        <span className="hero-art-index">01 / DISCOVER SOMETHING RARE</span>
      </div>
    </section>

    <section className="trust-strip"><div className="wrap trust-inner"><div><ShieldCheck size={18} /><span><strong>Reviewed listings</strong><small>Every listing is reviewed before bidding</small></span></div><div><Compass size={18} /><span><strong>Objects with provenance</strong><small>Evidence and condition, clearly described</small></span></div><div><Clock3 size={18} /><span><strong>Transparent auctions</strong><small>Server-timed bidding, live updates</small></span></div></div></section>

    <section className="market-section wrap" id="marketplace">
      <div className="section-heading"><div><div className="eyebrow"><span className="eyebrow-line" /> THE MARKETPLACE</div><h2>Explore the <em>extraordinary.</em></h2><p>From storied heirlooms to unexpected treasures.</p></div><Link to="/?status=upcoming" className="text-link desktop-only">See upcoming auctions <ArrowUpRight size={16} /></Link></div>
      <form className="market-toolbar" onSubmit={applySearch}>
        <div className="category-tabs">{categories.map(item => <button type="button" key={item} className={`category-tab ${category === item ? 'selected' : ''}`} onClick={() => { setCategory(item); setSearchParams({ ...(item !== 'All' ? { category: item } : {}), ...(query.trim() ? { q: query.trim() } : {}), ...(status ? { status } : {}) }); }}>{item}</button>)}</div>
        <div className="toolbar-controls"><label className="filter-search"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search lots…" /></label><label className="sort-control"><SlidersHorizontal size={15} /><select value={sort} onChange={e => setSort(e.target.value)} aria-label="Sort auctions"><option value="ending">Ending soon</option><option value="newest">Recently listed</option><option value="priceAsc">Price: low to high</option><option value="priceDesc">Price: high to low</option><option value="popular">Most bids</option></select></label><label className="sort-control verification-filter"><ShieldCheck size={15} /><select value={authenticityStatus} onChange={e => setAuthenticityStatus(e.target.value)} aria-label="Filter by product verification"><option value="">Any verification status</option><option value="evidence_reviewed">Evidence reviewed</option><option value="specialist_authentication_pending">Specialist review pending</option><option value="specialist_authenticated">Specialist authenticated</option><option value="unable_to_verify">Unable to verify</option><option value="not_assessed">Not assessed</option></select></label></div>
      </form>
      <div className="filter-pills"><button className={!status ? 'filter-pill active' : 'filter-pill'} onClick={() => { setStatus(''); setSearchParams({ ...(category !== 'All' ? { category } : {}), ...(query.trim() ? { q: query.trim() } : {}) }); }}>All lots</button><button className={status === 'live' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setStatus('live'); setSearchParams({ status: 'live', ...(category !== 'All' ? { category } : {}), ...(query.trim() ? { q: query.trim() } : {}) }); }}>Live now <span className="live-pulse" /></button><button className={status === 'upcoming' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setStatus('upcoming'); setSearchParams({ status: 'upcoming', ...(category !== 'All' ? { category } : {}), ...(query.trim() ? { q: query.trim() } : {}) }); }}>Upcoming</button><button className={status === 'ended' ? 'filter-pill active' : 'filter-pill'} onClick={() => { setStatus('ended'); setSearchParams({ status: 'ended', ...(category !== 'All' ? { category } : {}), ...(query.trim() ? { q: query.trim() } : {}) }); }}>Recently closed</button>{(query || category !== 'All' || status || authenticityStatus) && <button className="clear-filter" onClick={() => { setQuery(''); setCategory('All'); setStatus(''); setSort('ending'); setAuthenticityStatus(''); setSearchParams({}); }}><X size={13} /> Clear filters</button>}</div>
      {error && <div className="inline-error">{error}</div>}
      {loading ? <div className="loading-grid">{[1, 2, 3, 4].map(i => <div className="skeleton-card" key={i}><div /><span /><span /><span /></div>)}</div> : auctions.length ? <div className="auction-grid">{auctions.map(auction => <AuctionCard key={auction._id} auction={auction} saved={savedIds.has(auction._id)} onToggleSave={toggleSave} />)}</div> : <div className="empty-state"><div className="empty-icon"><Search size={25} /></div><h3>No lots found just yet</h3><p>Try a different search or category. New finds are added regularly.</p><button className="button-outline" onClick={() => { setQuery(''); setCategory('All'); setStatus(''); setSearchParams({}); }}>Reset discovery</button></div>}
      {!loading && auctions.length > 0 && <div className="catalog-footer"><span>Showing {auctions.length} {auctions.length === 1 ? 'lot' : 'lots'}{liveAuctions.length > 0 ? ` · ${liveAuctions.length} live right now` : ''}</span><button className="button-outline" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>Back to top <ArrowUpRight size={15} /></button></div>}
    </section>
    <section className="sell-banner"><div className="wrap sell-banner-inner"><div><div className="eyebrow"><span className="eyebrow-line" /> HAVE SOMETHING SPECIAL?</div><h2>Its next chapter<br />could start <em>with you.</em></h2><p>Give a meaningful object the audience it deserves. Submit your item, share its story, and let collectors decide its value.</p><Link to={user?.sellerVerificationStatus === 'verified' ? '/sell' : '/verification'} className="button-light">Start selling <ArrowRight size={16} /></Link></div><div className="sell-banner-art"><div className="sell-art-circle">R<span>B</span></div><span className="sell-art-caption">A MARKET FOR THE MEANINGFUL</span></div></div></section>
    <footer className="site-footer"><div className="wrap footer-inner"><Link className="brand footer-brand" to="/"><span className="brand-mark"><span>R</span></span><span>rare<span className="brand-light">bid</span><small>OBJECTS WITH A STORY</small></span></Link><span>Built for the things worth keeping.</span><span>© {new Date().getFullYear()} RareBid · MVP</span></div></footer>
  </main>;
}
