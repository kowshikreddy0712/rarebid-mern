import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bookmark, Compass, Heart, X } from 'lucide-react';
import { api, getErrorMessage } from '../api';
import { useAuth } from '../context/AuthContext';
import AuctionCard from '../components/AuctionCard';

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  const [auctions, setAuctions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() { setLoading(true); try { const { data } = await api.get('/users/watchlist'); setAuctions(data.auctions || []); } catch (err) { setError(getErrorMessage(err)); } finally { setLoading(false); } }
  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);
  async function remove(auction) { try { await api.delete(`/users/watchlist/${auction._id}`); setAuctions(items => items.filter(item => item._id !== auction._id)); } catch (err) { setError(getErrorMessage(err)); } }
  if (authLoading) return <main className="wrap page-content"><div className="page-loading">Loading…</div></main>;
  if (!user) return <Navigate to="/login" replace />;
  return <main className="wrap page-content"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR COLLECTION</div><h1>Your <em>watchlist.</em></h1><p>Keep the pieces you love a little closer.</p></div><div className="page-title-icon"><Bookmark size={23} /></div></div>{error && <div className="inline-error">{error}</div>}{loading ? <div className="loading-grid">{[1,2,3].map(n => <div className="skeleton-card" key={n}><div /><span /><span /><span /></div>)}</div> : auctions.length ? <><div className="watchlist-count">{auctions.length} saved {auctions.length === 1 ? 'lot' : 'lots'}</div><div className="auction-grid">{auctions.map(auction => <AuctionCard key={auction._id} auction={auction} saved onToggleSave={remove} />)}</div></> : <div className="empty-state"><div className="empty-icon"><Heart size={25} /></div><h3>Your watchlist is waiting</h3><p>Save a lot to keep track of its price and closing time.</p><Link to="/" className="button-primary">Explore auctions <Compass size={16} /></Link></div>}</main>;
}
