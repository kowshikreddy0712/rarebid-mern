import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { Bell, CheckCheck, Clock3, ExternalLink, Info, PackageCheck, ShieldCheck } from 'lucide-react';
import { api, formatDate, getErrorMessage } from '../api';
import { useAuth } from '../context/AuthContext';

const iconFor = type => type === 'auction_start' ? <Clock3 size={17} /> : type === 'auction_won' ? <PackageCheck size={17} /> : type === 'payment_deadline' ? <Info size={17} /> : <ShieldCheck size={17} />;
export default function NotificationsPage() {
  const { user, loading: authLoading } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const { data } = await api.get('/users/notifications'); setNotifications(data.notifications || []); setUnreadCount(data.unreadCount || 0); }
    catch (err) { setError(getErrorMessage(err)); }
    finally { setLoading(false); }
  }
  useEffect(() => { if (user) load(); else setLoading(false); }, [user]);
  if (authLoading) return <main className="wrap page-content"><div className="page-loading">Loading…</div></main>;
  if (!user) return <Navigate to="/login" replace />;
  async function markAllRead() {
    try { await api.patch('/users/notifications/read-all'); setNotifications(items => items.map(item => ({ ...item, readAt: item.readAt || new Date().toISOString() }))); setUnreadCount(0); }
    catch (err) { setError(getErrorMessage(err)); }
  }
  async function markRead(notification) {
    if (notification.readAt) return;
    try { await api.patch(`/users/notifications/${notification._id}/read`); setNotifications(items => items.map(item => item._id === notification._id ? { ...item, readAt: new Date().toISOString() } : item)); setUnreadCount(count => Math.max(0, count - 1)); }
    catch (err) { setError(getErrorMessage(err)); }
  }
  return <main className="wrap page-content"><div className="page-title-row"><div><div className="eyebrow"><span className="eyebrow-line" /> YOUR RAREBID</div><h1>Notifications<em>.</em></h1><p>Auction reminders and important updates, all in one place.</p></div><div className="notification-title-action">{unreadCount > 0 && <button className="button-outline" onClick={markAllRead}><CheckCheck size={15} /> Mark all read</button>}<span className="page-title-icon"><Bell size={23} /></span></div></div>{error && <div className="inline-error">{error}</div>}{loading ? <div className="page-loading">Loading notifications…</div> : notifications.length ? <div className="notification-list">{notifications.map(item => <article className={`notification-row ${item.readAt ? 'is-read' : 'is-unread'}`} key={item._id} onClick={() => markRead(item)}><div className="notification-icon">{iconFor(item.type)}</div><div className="notification-copy"><strong>{item.message}</strong><span>{formatDate(item.createdAt)}</span>{item.auction && <Link to={`/auctions/${item.auction._id}`} className="text-link" onClick={e => e.stopPropagation()}>View auction <ExternalLink size={13} /></Link>}</div>{!item.readAt && <span className="unread-dot" />}</article>)}</div> : <div className="empty-state"><div className="empty-icon"><Bell size={24} /></div><h3>All quiet for now</h3><p>Set a reminder on an upcoming auction and we’ll add an in-app notification here.</p><Link to="/?status=upcoming" className="button-primary">Browse upcoming auctions</Link></div>}</main>;
}
