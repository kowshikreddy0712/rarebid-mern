import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Check, ExternalLink, FileText, Gavel, RefreshCw, ShieldCheck, Users, X } from 'lucide-react';
import { API_BASE, api, formatDate, formatINR, getErrorMessage } from '../api';
import { useAuth } from '../context/AuthContext';

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const [tab, setTab] = useState('listings');
  const [overview, setOverview] = useState({ users: 0, pendingVerifications: 0, pendingListings: 0, liveAuctions: 0, orders: 0 });
  const [listings, setListings] = useState([]);
  const [verifications, setVerifications] = useState([]);
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [workingId, setWorkingId] = useState('');
  const [authChoices, setAuthChoices] = useState({});
  const [authNotes, setAuthNotes] = useState({});
  async function load() {
    if (!user || user.role !== 'admin') return;
    setLoading(true); setError('');
    try {
      const [ov, li, ve, od] = await Promise.all([api.get('/admin/overview'), api.get('/admin/listings'), api.get('/admin/verifications'), api.get('/admin/orders')]);
      setOverview(ov.data); setListings(li.data.auctions); setVerifications(ve.data.users); setOrders(od.data.orders);
    } catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user?.role === 'admin') load(); else setLoading(false); }, [user]);
  if (authLoading) return <main className="wrap page-content"><div className="page-loading">Loading…</div></main>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== 'admin') return <main className="wrap page-content"><div className="empty-state"><h3>Administrator access only</h3><p>This area is restricted to authorized administrators.</p><Link to="/" className="button-primary">Back to marketplace</Link></div></main>;
  async function reviewListing(item, decision) {
    setWorkingId(item._id); setError('');
    try { await api.patch(`/admin/listings/${item._id}`, { decision }); await load(); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setWorkingId(''); }
  }
  async function saveAuthenticity(item) {
    setWorkingId(item._id); setError('');
    try { await api.patch(`/admin/listings/${item._id}/authenticity`, { authenticityStatus: authChoices[item._id] || item.authenticityStatus || 'not_assessed', authenticityReviewNote: authNotes[item._id] ?? item.authenticityReviewNote ?? '' }); await load(); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setWorkingId(''); }
  }
  async function reviewSeller(item, decision) {
    setWorkingId(item._id); setError('');
    try { await api.patch(`/admin/verifications/${item._id}`, { decision }); await load(); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setWorkingId(''); }
  }
  const metrics = [{ label: 'Registered users', value: overview.users, icon: <Users size={18} /> }, { label: 'Seller reviews', value: overview.pendingVerifications, icon: <ShieldCheck size={18} /> }, { label: 'Listings to review', value: overview.pendingListings, icon: <FileText size={18} /> }, { label: 'Live auctions', value: overview.liveAuctions, icon: <Gavel size={18} /> }];
  return <main className="wrap page-content admin-page"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-line" /> CONTROL ROOM</div><h1>Admin <em>review.</em></h1><p>Review sellers and listings before they reach the marketplace.</p></div><button className="button-outline" onClick={load}><RefreshCw size={15} /> Refresh</button></div>{error && <div className="inline-error">{error}</div>}<div className="admin-metrics">{metrics.map(metric => <div className="admin-metric" key={metric.label}><div className="admin-metric-icon">{metric.icon}</div><span>{metric.label}</span><strong>{metric.value}</strong></div>)}</div><div className="activity-tabs admin-tabs">{[{id:'listings',label:'Listing review',count:listings.length},{id:'verifications',label:'Seller verification',count:verifications.length},{id:'orders',label:'Orders',count:orders.length}].map(item => <button className={tab === item.id ? 'active' : ''} key={item.id} onClick={() => setTab(item.id)}>{item.label}<span>{item.count}</span></button>)}</div>
  {loading ? <div className="page-loading">Loading review queue…</div> : <div className="admin-review-list">{tab === 'listings' && (listings.length ? listings.map(item => <div className="review-card" key={item._id}><img src={item.imageUrl} alt="" /><div className="review-card-main"><div className="review-card-kicker">{item.category} · Submitted {formatDate(item.createdAt)}</div><h3>{item.title}</h3><p>{item.description}</p><div className="review-card-meta"><span>Seller: <strong>{item.seller?.name}</strong> ({item.seller?.sellerVerificationStatus})</span><span>Starting price: <strong>{formatINR(item.startingPrice)}</strong></span><span>Starts: {formatDate(item.startAt)}</span></div>{item.evidenceDescription && <div className="evidence-admin"><FileText size={15} /> {item.evidenceDescription}</div>}{item.evidenceDocuments?.length > 0 && <div className="evidence-admin evidence-downloads"><FileText size={15} /><span>Supporting documents:</span>{item.evidenceDocuments.map(doc => <a key={doc._id} href={`${API_BASE}/uploads/evidence-documents/${doc._id}`} target="_blank" rel="noreferrer">{doc.originalName}</a>)}</div>}<div className="auth-review-panel"><strong>Product authenticity review</strong><span className={`status-tag ${item.authenticityStatus === 'specialist_authenticated' ? 'approved' : 'pending'}`}>{(item.authenticityStatus || 'not_assessed').replaceAll('_', ' ')}</span><div className="form-grid-2"><label className="field-label">Review status<select value={authChoices[item._id] || item.authenticityStatus || 'not_assessed'} onChange={e => setAuthChoices(prev => ({ ...prev, [item._id]: e.target.value }))}><option value="not_assessed">Not assessed</option><option value="evidence_reviewed">Evidence reviewed</option><option value="specialist_authentication_pending">Specialist authentication pending</option><option value="specialist_authenticated">Specialist authenticated</option><option value="unable_to_verify">Unable to verify</option></select></label><label className="field-label">Reviewer note<input value={authNotes[item._id] ?? item.authenticityReviewNote ?? ''} onChange={e => setAuthNotes(prev => ({ ...prev, [item._id]: e.target.value }))} placeholder="Reason, certificate reference, reviewer…" maxLength={1000} /></label></div><button className="button-outline" disabled={workingId === item._id} onClick={() => saveAuthenticity(item)}>Save authenticity status</button><p className="field-help">“Specialist authenticated” should only be used after independent specialist verification. Listing approval alone is not proof of authenticity.</p></div><div className="review-actions"><button className="button-approve" disabled={workingId === item._id} onClick={() => reviewListing(item, 'approved')}><Check size={15} /> Approve listing</button><button className="button-reject" disabled={workingId === item._id} onClick={() => reviewListing(item, 'rejected')}><X size={15} /> Reject</button></div></div></div>) : <div className="empty-state compact-empty"><h3>Review queue is clear</h3><p>New listing submissions will appear here.</p></div>)}{tab === 'verifications' && (verifications.length ? verifications.map(item => <div className="review-card verification-review" key={item._id}><div className="review-avatar">{item.name?.slice(0,1)}</div><div className="review-card-main"><div className="review-card-kicker">Submitted {formatDate(item.sellerVerification?.submittedAt || item.createdAt)}</div><h3>{item.name}</h3><p>{item.email}</p><div className="review-card-meta"><span>Legal name: <strong>{item.sellerVerification?.fullLegalName || 'Not supplied'}</strong></span><span>Evidence reference: <strong>{item.sellerVerification?.evidenceReference || 'Not supplied'}</strong></span>{item.sellerVerification?.contactNote && <span>Note: {item.sellerVerification.contactNote}</span>}</div>{item.sellerVerification?.documentIds?.length > 0 && <div className="evidence-admin evidence-downloads"><FileText size={15} /><span>Seller evidence:</span>{item.sellerVerification.documentIds.map(doc => <a key={doc._id} href={`${API_BASE}/uploads/evidence-documents/${doc._id}`} target="_blank" rel="noreferrer">{doc.originalName}</a>)}</div>}<div className="subtle-callout admin-warning"><ShieldCheck size={16} /><p>Reference-only review: this MVP does not perform third-party identity checks or securely host identity documents.</p></div><div className="review-actions"><button className="button-approve" disabled={workingId === item._id} onClick={() => reviewSeller(item, 'verified')}><Check size={15} /> Mark verified</button><button className="button-reject" disabled={workingId === item._id} onClick={() => reviewSeller(item, 'rejected')}><X size={15} /> Reject</button></div></div></div>) : <div className="empty-state compact-empty"><h3>No pending seller reviews</h3><p>New verification requests will appear here.</p></div>)}{tab === 'orders' && (orders.length ? orders.map(order => <div className="activity-row" key={order._id}><img src={order.auction?.imageUrl || 'https://images.unsplash.com/photo-1577083552431-6e5fd01aa342?auto=format&fit=crop&w=300&q=70'} alt="" /><div className="activity-main"><strong>{order.auction?.title || 'Auction order'}</strong><span>Buyer: {order.buyer?.name} · Seller: {order.seller?.name}</span><span>{formatDate(order.createdAt)}</span></div><div className="activity-status"><span className="status-tag pending">{order.paymentStatus.replace('_', ' ')}</span><strong>{formatINR(order.winningBidAmount)}</strong></div></div>) : <div className="empty-state compact-empty"><h3>No orders yet</h3><p>Orders are created when auctions end with an accepted winning bid.</p></div>)}</div>}
  </main>;
}
